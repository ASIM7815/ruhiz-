"use client";

import { useStore } from "@/store/store";
import { ComposerModal, EditPostModal } from "@/components/feed/ComposerModal";
import { HelpModal, ProposeModal, StatusModal } from "@/components/problem/ProblemModals";
import { RequestSupportModal, SupportProfileModal } from "@/components/support/SupportModals";
import { ConfirmModal, DeleteAccountModal, EditProfileModal, LogoutModal, NewMessageModal, PeopleModal, PledgeModal, ReportModal, ShareModal } from "./CommonModals";

/** Renders whichever global modal is open. */
export function ModalHost() {
  const { state, actions } = useStore();
  const m = state.modal;
  const close = actions.closeModal;
  if (!m) return null;
  switch (m.type) {
    case "composer":
      return <ComposerModal kind={m.kind} addresses={m.addresses} onClose={close} />;
    case "editPost":
      return <EditPostModal post={m.post} onClose={close} />;
    case "share":
      return <ShareModal target={m.target} onClose={close} />;
    case "help":
      return <HelpModal post={m.post} onClose={close} />;
    case "propose":
      return <ProposeModal problem={m.problem} onClose={close} />;
    case "status":
      return <StatusModal post={m.post} onClose={close} />;
    case "pledge":
      return <PledgeModal solution={m.solution} onClose={close} />;
    case "people":
      return <PeopleModal code={m.code} list={m.list} onClose={close} />;
    case "editProfile":
      return <EditProfileModal onClose={close} />;
    case "supportProfile":
      return <SupportProfileModal listing={m.listing} onClose={close} />;
    case "requestSupport":
      return <RequestSupportModal listing={m.listing} onClose={close} />;
    case "newMessage":
      return <NewMessageModal initialCode={m.code} onClose={close} />;
    case "report":
      return <ReportModal target={m.target} onClose={close} />;
    case "confirm":
      return <ConfirmModal {...m} onClose={close} />;
    case "deleteAccount":
      return <DeleteAccountModal onClose={close} />;
    case "logout":
      return <LogoutModal onClose={close} />;
  }
}
