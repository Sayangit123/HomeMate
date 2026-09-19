import { create } from "zustand";

interface CheckoutStore {
    shippingAddress: string;
    paymentMethod: string;

    setShippingAddress: (
        address: string
    ) => void;

    setPaymentMethod: (
        method: string
    ) => void;

    resetCheckout: () => void;
}

export const useCheckoutStore =
    create<CheckoutStore>((set) => ({
        shippingAddress: "",
        paymentMethod: "Online Payment",

        setShippingAddress: (address) =>
            set({
                shippingAddress: address,
            }),

        setPaymentMethod: (method) =>
            set({
                paymentMethod: method,
            }),

        resetCheckout: () =>
            set({
                shippingAddress: "",
                paymentMethod:
                    "Online Payment",
            }),
    }));