import { create } from "zustand";

interface BookingStore {
  selectedService: string;
  selectedProperty: string;
  bookingDate: string;
  bookingTime: string;
  notes: string;
  statusFilter: string; // <--- added

  setSelectedService: (serviceId: string) => void;
  setSelectedProperty: (propertyId: string) => void;
  setBookingDate: (date: string) => void;
  setBookingTime: (time: string) => void;
  setNotes: (notes: string) => void;
  setStatusFilter: (status: string) => void; // <--- added

  resetBooking: () => void;
}

export const useBookingStore = create<BookingStore>((set) => ({
  selectedService: "",
  selectedProperty: "",
  bookingDate: "",
  bookingTime: "",
  notes: "",
  statusFilter: "All", // <--- added

  setSelectedService: (serviceId) =>
    set({
      selectedService: serviceId,
    }),

  setSelectedProperty: (propertyId) =>
    set({
      selectedProperty: propertyId,
    }),

  setBookingDate: (date) =>
    set({
      bookingDate: date,
    }),

  setBookingTime: (time) =>
    set({
      bookingTime: time,
    }),

  setNotes: (notes) =>
    set({
      notes,
    }),

  setStatusFilter: (statusFilter) =>
    set({
      statusFilter,
    }),

  resetBooking: () =>
    set({
      selectedService: "",
      selectedProperty: "",
      bookingDate: "",
      bookingTime: "",
      notes: "",
      statusFilter: "All",
    }),
}));