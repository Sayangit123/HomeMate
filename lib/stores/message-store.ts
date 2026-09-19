import { create } from "zustand";

interface MessageStore {
    selectedMemberId: string | null;
    searchTerm: string;

    setSelectedMemberId: (
        memberId: string | null
    ) => void;

    setSearchTerm: (
        value: string
    ) => void;

    clearSelectedMember: () => void;

    clearSearch: () => void;
}

export const useMessageStore =
    create<MessageStore>((set) => ({
        selectedMemberId: null,

        searchTerm: "",

        setSelectedMemberId: (memberId) =>
            set({
                selectedMemberId: memberId,
            }),

        setSearchTerm: (value) =>
            set({
                searchTerm: value,
            }),

        clearSelectedMember: () =>
            set({
                selectedMemberId: null,
            }),

        clearSearch: () =>
            set({
                searchTerm: "",
            }),
    }));