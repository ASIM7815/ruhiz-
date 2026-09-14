/**
 * Builds a structurally valid ISO-BMFF (MP4) fixture.
 *
 * The sandbox has no ffmpeg and no browser, so this is a hand-assembled
 * container: correct `ftyp`/`moov`/`mdat` box nesting, sizes and brands, with a
 * synthetic video payload. That is enough to assert everything the bug actually
 * touches — signature validity, stored Content-Type, byte-range streaming and
 * byte-for-byte round-trip — which is all server/transport side.
 */

const u32 = (n) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0, 0);
  return b;
};

function box(type, ...payload) {
  const body = Buffer.concat(payload.map((p) => (Buffer.isBuffer(p) ? p : Buffer.from(p))));
  return Buffer.concat([u32(body.length + 8), Buffer.from(type, 'latin1'), body]);
}

function fullBox(type, version, flags, ...payload) {
  const vf = Buffer.alloc(4);
  vf.writeUInt8(version, 0);
  vf.writeUIntBE(flags, 1, 3);
  return box(type, vf, ...payload);
}

/**
 * @param {number} bytes size of the synthetic media payload
 */
export function makeMp4(bytes = 64 * 1024) {
  const timescale = 30000;
  const duration = timescale; // 1 second

  // ftyp — brands a browser/ffprobe recognises as progressive MP4
  const ftyp = box(
    'ftyp',
    Buffer.from('isom', 'latin1'),
    u32(0x200),
    Buffer.from('isomiso2avc1mp41', 'latin1')
  );

  const mvhd = fullBox('mvhd', 0, 0,
    u32(0), u32(0),            // creation/modification time
    u32(timescale), u32(duration),
    u32(0x00010000),           // rate 1.0
    Buffer.from([0x01, 0x00]), // volume 1.0
    Buffer.alloc(10),
    // unity matrix
    Buffer.from([
      0x00,0x01,0x00,0x00, 0,0,0,0, 0,0,0,0,
      0,0,0,0, 0x00,0x01,0x00,0x00, 0,0,0,0,
      0,0,0,0, 0,0,0,0, 0x40,0x00,0x00,0x00,
    ]),
    Buffer.alloc(24),          // pre-defined
    u32(2)                     // next track id
  );

  const tkhd = fullBox('tkhd', 0, 0x000003, // enabled|in_movie
    u32(0), u32(0), u32(1), u32(0), u32(duration),
    Buffer.alloc(8),
    Buffer.from([0, 0]),       // layer
    Buffer.from([0, 0]),       // alternate group
    Buffer.from([0, 0]),       // volume
    Buffer.alloc(2),
    Buffer.from([
      0x00,0x01,0x00,0x00, 0,0,0,0, 0,0,0,0,
      0,0,0,0, 0x00,0x01,0x00,0x00, 0,0,0,0,
      0,0,0,0, 0,0,0,0, 0x40,0x00,0x00,0x00,
    ]),
    u32(640 << 16), u32(360 << 16) // width/height 16.16
  );

  const mdhd = fullBox('mdhd', 0, 0,
    u32(0), u32(0), u32(timescale), u32(duration),
    Buffer.from([0x55, 0xc4]),  // language 'und'
    Buffer.from([0, 0])
  );

  const hdlr = fullBox('hdlr', 0, 0,
    u32(0),
    Buffer.from('vide', 'latin1'),
    Buffer.alloc(12),
    Buffer.from('VideoHandler\0', 'latin1')
  );

  const vmhd = fullBox('vmhd', 0, 0x000001, u32(0), Buffer.alloc(6));

  const dref = fullBox('dref', 0, 0, u32(1), fullBox('url ', 0, 0x000001));
  const dinf = box('dinf', dref);

  // Minimal avc1 sample entry (no real codec config — see file header).
  const avcC = box('avcC',
    Buffer.from([1, 0x42, 0x00, 0x1e, 0xff, 0xe1]),
    Buffer.from([0, 2]), Buffer.from([0x67, 0x42]),
    Buffer.from([1]), Buffer.from([0, 2]), Buffer.from([0x68, 0xce])
  );
  const avc1 = box('avc1',
    Buffer.alloc(6), u32(1), Buffer.alloc(16),
    Buffer.from([0, 0x00]), Buffer.from([0, 0x00]),
    u32(640 << 16), u32(360 << 16),
    u32(0x00480000), u32(0x00480000),
    u32(0), Buffer.from([0, 1]),
    Buffer.alloc(32),
    Buffer.from([0, 0x18]), Buffer.from([0xff, 0xff]),
    avcC
  );
  const stsd = fullBox('stsd', 0, 0, u32(1), avc1);

  const stts = fullBox('stts', 0, 0, u32(1), u32(1), u32(duration));
  const stsc = fullBox('stsc', 0, 0, u32(1), u32(1), u32(1), u32(1));
  const stsz = fullBox('stsz', 0, 0, u32(0), u32(1), u32(bytes));

  // mdat offset = ftyp + moov + 8; moov size computed after assembly, so do
  // two passes.
  const stcoPass = (mdatOffset) => fullBox('stco', 0, 0, u32(1), u32(mdatOffset));

  const build = (mdatOffset) => {
    const stbl = box('stbl', stsd, stts, stsc, stsz, stcoPass(mdatOffset));
    const minf = box('minf', vmhd, dinf, stbl);
    const mdia = box('mdia', mdhd, hdlr, minf);
    const trak = box('trak', tkhd, mdia);
    return box('moov', mvhd, trak);
  };

  // pass 1: size of moov with a placeholder offset
  const moov1 = build(0);
  const mdatOffset = ftyp.length + moov1.length + 8;
  const moov = build(mdatOffset);

  // Synthetic payload with a recognisable marker so round-trip is provable.
  const payload = Buffer.alloc(bytes);
  Buffer.from('RUHIZ-E2E-VIDEO-PAYLOAD', 'latin1').copy(payload, 0);
  for (let i = 24; i < bytes; i++) payload[i] = (i * 31) & 0xff;

  const mdat = box('mdat', payload);
  return Buffer.concat([ftyp, moov, mdat]);
}

export const MP4_BRAND_OFFSET = 8; // 'ftyp' sits at byte 4, brand at 8
