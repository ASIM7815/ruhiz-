"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, Image as ImageIcon, Loader2, MapPin, PenLine, Upload, Video, X } from "lucide-react";
import type { CategoryId, IdentityMode, Post, PostKind } from "@/lib/types";
import { CATEGORIES } from "@/lib/meta";
import { api, ApiError, revalidate } from "@/lib/api";
import { checkFile, UPLOAD_LIMITS, uploadFile } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { useMe, useStore } from "@/store/store";
import { Modal } from "@/components/ui/Modal";
import { Field, Segmented } from "@/components/ui/Primitives";
import { Avatar } from "@/components/ui/Avatar";
import { IdentityPicker } from "./IdentityPicker";
import { POST_KEYS } from "./PostCard";

const INTENTS: { id: Post["intent"]; label: string; desc: string }[] = [
  { id: "problem", label: "Problem", desc: "Something real that needs understanding or a solution." },
  { id: "experience", label: "Experience", desc: "Something you lived through that could help others." },
  { id: "support", label: "Seeking support", desc: "You need people, not necessarily answers." },
  { id: "thought", label: "Thought", desc: "An idea, reflection or question." },
  { id: "solution", label: "Solution", desc: "An approach that could help with a problem." },
  { id: "update", label: "Progress update", desc: "News on a problem or solution you're involved in." },
];

interface Item {
  key: string;
  file: File;
  preview: string;
  progress: number;
  mediaId?: string;
  error?: string;
}

export function ComposerModal({ kind: initialKind, addresses, onClose }: { kind: PostKind; addresses?: { id: string; title: string }; onClose: () => void }) {
  const { actions } = useStore();
  const me = useMe();
  const router = useRouter();
  const [kind, setKind] = useState<PostKind>(initialKind);
  const [intent, setIntent] = useState<Post["intent"]>(addresses ? "solution" : initialKind === "thought" ? "thought" : "experience");
  const [category, setCategory] = useState<CategoryId>("community");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  // Hidden by default: Revealer is only possible (and only pre-selected) while the account is revealed.
  const [identity, setIdentity] = useState<IdentityMode>(me.identity === "revealer" ? me.settings.defaultIdentity : "saver");
  const [tagArea, setTagArea] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const aborts = useRef<Map<string, AbortController>>(new Map());

  useEffect(
    () => () => {
      aborts.current.forEach((a) => a.abort());
      items.forEach((i) => URL.revokeObjectURL(i.preview));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const mediaKind = kind === "video" ? "video" : "image";
  const max = kind === "video" ? 1 : 6;
  const uploading = items.some((i) => !i.mediaId && !i.error);
  const ready = items.filter((i) => i.mediaId);
  const needsTitle = intent === "problem" || intent === "solution";
  const valid = text.trim().length >= 10 && (!needsTitle || title.trim().length >= 6) && (kind === "thought" || ready.length > 0) && !uploading;

  const startUpload = (item: Item) => {
    const ctrl = new AbortController();
    aborts.current.set(item.key, ctrl);
    uploadFile(item.file, {
      purpose: "post",
      kind: mediaKind,
      alt: item.file.name.replace(/\.[^.]+$/, "").slice(0, 120),
      signal: ctrl.signal,
      onProgress: (p) => setItems((xs) => xs.map((x) => (x.key === item.key ? { ...x, progress: p } : x))),
    })
      .then((id) => setItems((xs) => xs.map((x) => (x.key === item.key ? { ...x, mediaId: id, progress: 100 } : x))))
      .catch((e) => setItems((xs) => xs.map((x) => (x.key === item.key ? { ...x, error: e instanceof ApiError ? e.message : "Upload failed" } : x))))
      .finally(() => aborts.current.delete(item.key));
  };

  const onFiles = (list: FileList | null) => {
    if (!list?.length) return;
    setError(null);
    const room = max - items.length;
    const picked = Array.from(list).slice(0, Math.max(room, 0));
    if (list.length > room) setError(kind === "video" ? "One video per post." : "You can add up to 6 photos.");
    const next: Item[] = [];
    for (const f of picked) {
      const problem = checkFile(f, mediaKind);
      if (problem) {
        setError(problem);
        continue;
      }
      next.push({ key: `${f.name}-${f.size}-${Math.random()}`, file: f, preview: URL.createObjectURL(f), progress: 0 });
    }
    setItems((xs) => [...xs, ...next]);
    next.forEach(startUpload);
    if (file.current) file.current.value = "";
  };

  const removeItem = (it: Item) => {
    aborts.current.get(it.key)?.abort();
    if (it.mediaId) api(`/api/media/${it.mediaId}`, { method: "DELETE" }).catch(() => {});
    URL.revokeObjectURL(it.preview);
    setItems((xs) => xs.filter((x) => x.key !== it.key));
  };

  const switchKind = (k: PostKind) => {
    items.forEach(removeItem);
    setKind(k);
    setError(null);
  };

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const post = await api<Post>("/api/posts", {
        body: {
          kind,
          intent,
          category,
          title: needsTitle || title.trim() ? title.trim() : undefined,
          text: text.trim(),
          identity,
          tagArea,
          addresses: addresses?.id,
          mediaIds: kind === "thought" ? [] : ready.map((i) => i.mediaId),
        },
      });
      items.forEach((i) => URL.revokeObjectURL(i.preview));
      setItems([]);
      revalidate(...POST_KEYS);
      onClose();
      actions.toast(intent === "problem" ? "Problem posted. It starts as Unsolved." : "Posted", "success", { label: "View", href: `/post/${post.id}` });
      if (addresses) router.push(`/post/${post.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={addresses ? "Respond with a post" : "Create a post"}
      subtitle={addresses ? <span className="line-clamp-1">To: {addresses.title}</span> : "Bring a problem, share what you've lived through, or offer what you know."}
      footer={
        <>
          <span className="mr-auto text-[0.76rem] text-faint">{text.length}/5000</span>
          <button onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button onClick={submit} disabled={!valid || submitting} className="btn btn-red min-w-24">
            {submitting ? <Loader2 className="size-4 animate-spin" /> : uploading ? "Uploading…" : "Post"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            value={kind}
            onChange={switchKind}
            options={[
              { id: "photo", label: "Photo", icon: ImageIcon },
              { id: "video", label: "Video", icon: Video },
              { id: "thought", label: "Thoughts", icon: PenLine },
            ]}
          />
          <select value={category} onChange={(e) => setCategory(e.target.value as CategoryId)} className="input h-9 w-auto min-w-44 text-[0.84rem]" aria-label="Category">
            {(Object.keys(CATEGORIES) as CategoryId[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORIES[c].label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="mb-1.5 text-[0.8rem] font-semibold text-ink-2">What are you sharing?</p>
          <div className="flex flex-wrap gap-1.5">
            {INTENTS.filter((i) => !addresses || i.id !== "problem").map((i) => (
              <button key={i.id} onClick={() => setIntent(i.id)} data-on={intent === i.id} className="chip" title={i.desc}>
                {intent === i.id && <Check className="size-3.5" />}
                {i.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[0.76rem] text-muted">
            {INTENTS.find((i) => i.id === intent)?.desc}
            {intent === "problem" && " It starts as Unsolved and moves forward as people contribute."}
          </p>
        </div>

        <div className="flex gap-3">
          <Avatar code={me.code} src={me.avatarUrl} size="md" />
          <div className="min-w-0 flex-1 space-y-2.5">
            {(needsTitle || title) && (
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder={intent === "problem" ? "Describe the problem in one line" : "Give it a title"} className="input font-semibold" aria-label="Title" />
            )}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 5000))}
              rows={5}
              autoFocus
              placeholder={intent === "problem" ? "What is happening, who it affects, and what you've already tried…" : "Share your thoughts, photo or video..."}
              className="input"
              aria-label="Post text"
            />
            {text.length > 0 && text.trim().length < 10 && <p className="text-[0.74rem] text-faint">Write at least 10 characters.</p>}
          </div>
        </div>

        {kind !== "thought" && (
          <div className="rounded-xl border border-line bg-black/15 p-3">
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[0.8rem] font-semibold text-ink-2">
                {kind === "photo" ? `Photos (${items.length}/6) · multiple photos become a carousel` : "Video"}
                <span className="ml-1 font-normal text-faint">
                  · max {UPLOAD_LIMITS[mediaKind].maxMB} MB {kind === "photo" ? "each · JPG, PNG, WebP, GIF" : "· MP4, WebM, MOV"}
                </span>
              </p>
              {items.length < max && (
                <button onClick={() => file.current?.click()} className="btn btn-outline btn-sm">
                  <Upload className="size-3.5" /> {items.length ? "Add more" : "Choose file"}
                </button>
              )}
              <input ref={file} type="file" hidden multiple={kind === "photo"} accept={UPLOAD_LIMITS[mediaKind].accept} onChange={(e) => onFiles(e.target.files)} />
            </div>

            {items.length === 0 ? (
              <button
                onClick={() => file.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  onFiles(e.dataTransfer.files);
                }}
                className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-line-strong px-4 py-8 text-[0.84rem] text-muted hover:border-brand/50 hover:text-ink-2"
              >
                {kind === "video" ? <Video className="size-6 text-brand-ink" /> : <ImageIcon className="size-6 text-brand-ink" />}
                Drop {kind === "video" ? "a video" : "photos"} here or click to choose
                <span className="text-[0.72rem] text-faint">{kind === "video" ? "MP4, WebM or MOV · up to 1 GB" : "JPG, PNG, WebP or GIF · up to 10 MB each"}</span>
              </button>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {items.map((it) => (
                  <div key={it.key} className="relative h-24 w-32 shrink-0 overflow-hidden rounded-lg bg-elev ring-1 ring-white/10">
                    {kind === "video" ? (
                      <video src={it.preview} className="size-full object-cover" muted />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.preview} alt="" className="size-full object-cover" />
                    )}
                    {!it.mediaId && !it.error && (
                      <div className="absolute inset-0 grid place-items-center bg-black/55 text-[0.78rem] font-semibold text-white">
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="size-3.5 animate-spin" /> {it.progress}%
                        </span>
                        <span className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
                          <span className="block h-full bg-brand transition-[width]" style={{ width: `${it.progress}%` }} />
                        </span>
                      </div>
                    )}
                    {it.error && (
                      <div className="absolute inset-0 grid place-items-center bg-rose-950/85 p-2 text-center text-[0.7rem] leading-tight text-rose-100" title={it.error} role="alert">
                        <span>
                          <CircleAlert className="mx-auto mb-1 size-4" />
                          <span className="line-clamp-2">{it.error}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const again = { ...it, error: undefined, progress: 0 };
                              setItems((xs) => xs.map((x) => (x.key === it.key ? again : x)));
                              startUpload(again);
                            }}
                            className="mt-1 rounded-md bg-white/15 px-2 py-0.5 font-semibold text-white hover:bg-white/25"
                          >
                            Retry
                          </button>
                        </span>
                      </div>
                    )}
                    {it.mediaId && (
                      <span className="absolute bottom-1 left-1 grid size-5 place-items-center rounded-full bg-emerald-500 text-white">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                    )}
                    <button onClick={() => removeItem(it)} className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/70 text-white" aria-label="Remove">
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Field label="Identity for this post">
          <IdentityPicker value={identity} onChange={setIdentity} />
        </Field>

        {me.location ? (
          <button onClick={() => setTagArea((n) => !n)} data-on={tagArea} className="chip">
            <MapPin className="size-3.5" /> {tagArea ? `Tagged: ${me.location} (shown in Nearby)` : `Tag my area (${me.location})`}
          </button>
        ) : (
          <p className="flex items-center gap-1.5 text-[0.78rem] text-muted">
            <MapPin className="size-3.5" /> Add your area in your profile to tag posts for Nearby.
          </p>
        )}

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-[0.84rem] text-rose-200">
            <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

export function EditPostModal({ post, onClose }: { post: Post; onClose: () => void }) {
  const { actions } = useStore();
  const [title, setTitle] = useState(post.title ?? "");
  const [text, setText] = useState(post.text);
  const [category, setCategory] = useState<CategoryId>(post.category);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsTitle = post.intent === "problem" || post.intent === "solution";
  const valid = text.trim().length >= 10 && (!needsTitle || title.trim().length >= 6);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api(`/api/posts/${post.id}`, { method: "PATCH", body: { title: title.trim() || null, text: text.trim(), category } });
      revalidate(...POST_KEYS);
      actions.toast("Post updated");
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Edit post"
      icon={<PenLine className="size-5" />}
      footer={
        <>
          <button onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button onClick={save} disabled={!valid || saving} className="btn btn-blue">
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Save changes"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} className="input font-semibold" />
        </Field>
        <Field label="Text" hint={`${text.length}/5000`}>
          <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 5000))} rows={7} className="input" />
        </Field>
        <Field label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value as CategoryId)} className="input">
            {(Object.keys(CATEGORIES) as CategoryId[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORIES[c].label}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-[0.76rem] text-faint">Photos and videos can't be changed after posting. Delete and re-post to replace them.</p>
        {error && <p className="text-[0.84rem] text-rose-300">{error}</p>}
      </div>
    </Modal>
  );
}
