import { create } from "zustand";

interface NotificationStore {
    selectedNotificationId: string | null;

    setSelectedNotificationId: (
        notificationId: string | null
    ) => void;

    clearSelectedNotification: () => void;
}

export const useNotificationStore =
    create<NotificationStore>((set) => ({
        selectedNotificationId: null,

        setSelectedNotificationId:
            (notificationId) =>
                set({
                    selectedNotificationId:
                        notificationId,
                }),

        clearSelectedNotification: () =>
            set({
                selectedNotificationId: null,
            }),
    }));