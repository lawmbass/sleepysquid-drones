import { useEffect, useState } from "react";
import { FiPlus } from "react-icons/fi";
import AddressAutocomplete from "@/components/booking/AddressAutocomplete";
import {
  BOOKING_SERVICES,
  BOOKING_STATUSES,
  availablePackages,
  minBookingDateTime,
  validateManualBooking,
} from "@/libs/manualBooking";

const fieldClass = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500";

const emptyForm = {
  service: "",
  package: "",
  date: "",
  location: "",
  placeId: "",
  details: "",
  name: "",
  email: "",
  phone: "",
  status: "pending",
  finalPrice: "",
  adminNotes: "",
};

function FieldError({ message }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-red-600 dark:text-red-400">{message}</p>;
}

export default function AddBookingForm({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [minDate, setMinDate] = useState("");

  useEffect(() => {
    setMinDate(minBookingDateTime());
  }, [open]);

  const packages = availablePackages(form.service);

  const update = (name, value) => {
    setForm((prev) => {
      if (name !== "service") return { ...prev, [name]: value };
      const nextPackages = availablePackages(value);
      const packageStillValid = nextPackages.some((pkg) => pkg.id === prev.package);
      return { ...prev, service: value, package: packageStillValid ? prev.package : "" };
    });
    setErrors((prev) => ({ ...prev, [name]: "", general: "" }));
  };

  const close = () => {
    setOpen(false);
    setErrors({});
  };

  const submit = async (event) => {
    event.preventDefault();
    setNotice("");
    const result = validateManualBooking(form);
    if (!form.placeId) {
      result.ok = false;
      result.errors = {
        ...result.errors,
        location: "Choose a US address from the list",
      };
      result.value = null;
    }
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }

    setSubmitting(true);
    setErrors({});
    try {
      const response = await fetch("/api/admin/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErrors(body.fields || { general: body.message || "Failed to add booking" });
        return;
      }
      setForm(emptyForm);
      setOpen(false);
      setNotice("Booking added.");
      if (onCreated) await onCreated();
    } catch {
      setErrors({ general: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bookings Management</h1>
          <p className="text-gray-600 dark:text-gray-300">Manage all customer bookings and service requests.</p>
        </div>
        <button
          type="button"
          onClick={() => (open ? close() : setOpen(true))}
          className="inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <FiPlus className="mr-2 h-4 w-4" />
          {open ? "Close" : "Add booking"}
        </button>
      </div>

      {notice && !open && (
        <p className="text-sm text-green-700 dark:text-green-400">{notice}</p>
      )}

      {open && (
        <form onSubmit={submit} className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 sm:p-6 space-y-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Add booking</h2>
          {errors.general && (
            <p className="text-sm text-red-600 dark:text-red-400">{errors.general}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="add-booking-service" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Service</label>
              <select
                id="add-booking-service"
                value={form.service}
                onChange={(event) => update("service", event.target.value)}
                className={fieldClass}
              >
                <option value="">Select a service</option>
                {BOOKING_SERVICES.map((service) => (
                  <option key={service.id} value={service.id}>{service.name}</option>
                ))}
              </select>
              <FieldError message={errors.service} />
            </div>

            <div>
              <label htmlFor="add-booking-package" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Package</label>
              <select
                id="add-booking-package"
                value={form.package}
                onChange={(event) => update("package", event.target.value)}
                className={fieldClass}
              >
                <option value="">No package</option>
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>{pkg.quote ? `${pkg.name} - from $${pkg.basePrice}` : `${pkg.name} - $${pkg.basePrice}`}</option>
                ))}
              </select>
              <FieldError message={errors.package} />
            </div>

            <div>
              <label htmlFor="add-booking-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
              <input
                id="add-booking-date"
                type="datetime-local"
                min={minDate}
                value={form.date}
                onChange={(event) => update("date", event.target.value)}
                className={fieldClass}
              />
              <FieldError message={errors.date} />
            </div>

            <div>
              <label htmlFor="add-booking-status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select
                id="add-booking-status"
                value={form.status}
                onChange={(event) => update("status", event.target.value)}
                className={fieldClass}
              >
                {BOOKING_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
              <FieldError message={errors.status} />
            </div>
          </div>

          <div>
            <label htmlFor="add-booking-location" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
            <AddressAutocomplete
              id="add-booking-location"
              value={form.location}
              selected={Boolean(form.placeId)}
              placeholder="Start typing a US address"
              autocompletePath="/api/admin/places/autocomplete"
              detailsPath="/api/admin/places/details"
              inputClassName={fieldClass}
              onChange={(text) => {
                setForm((prev) => ({ ...prev, location: text, placeId: "" }));
                setErrors((prev) => ({ ...prev, location: "", general: "" }));
              }}
              onSelect={(place) => {
                setForm((prev) => ({ ...prev, location: place.location, placeId: place.placeId }));
                setErrors((prev) => ({ ...prev, location: "", general: "" }));
              }}
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Start typing, then choose a US address from the list.</p>
            <FieldError message={errors.location} />
          </div>

          <div>
            <label htmlFor="add-booking-details" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Details</label>
            <textarea
              id="add-booking-details"
              rows={3}
              maxLength={1000}
              value={form.details}
              onChange={(event) => update("details", event.target.value)}
              className={fieldClass}
            />
            <FieldError message={errors.details} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="add-booking-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
              <input
                id="add-booking-name"
                type="text"
                maxLength={100}
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                className={fieldClass}
              />
              <FieldError message={errors.name} />
            </div>
            <div>
              <label htmlFor="add-booking-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input
                id="add-booking-email"
                type="email"
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
                className={fieldClass}
              />
              <FieldError message={errors.email} />
            </div>
            <div>
              <label htmlFor="add-booking-phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
              <input
                id="add-booking-phone"
                type="tel"
                value={form.phone}
                onChange={(event) => update("phone", event.target.value)}
                className={fieldClass}
              />
              <FieldError message={errors.phone} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="add-booking-price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Final price</label>
              <input
                id="add-booking-price"
                type="number"
                min="0"
                step="0.01"
                value={form.finalPrice}
                onChange={(event) => update("finalPrice", event.target.value)}
                className={fieldClass}
                placeholder="0.00"
              />
              <FieldError message={errors.finalPrice} />
            </div>
            <div>
              <label htmlFor="add-booking-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Admin notes</label>
              <textarea
                id="add-booking-notes"
                rows={2}
                maxLength={500}
                value={form.adminNotes}
                onChange={(event) => update("adminNotes", event.target.value)}
                className={fieldClass}
              />
              <FieldError message={errors.adminNotes} />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Save booking"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
