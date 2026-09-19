// "use client";

// import Link from "next/link";
// import { useEffect, useState } from "react";
// import Swal from "sweetalert2";

// import {
//     getCurrentUser,
//     logoutAccount,
// } from "@/lib/appwrite/account";

// import {
//     getCurrentMember,
//     type MemberRow,
// } from "@/lib/appwrite/database";

// import { getProfileImageUrl } from "@/lib/appwrite/storage";

// export default function ProfessionalDashboard() {
//     const [user, setUser] = useState<any>(null);
//     const [member, setMember] = useState<MemberRow | null>(null);
//     const [profileImage, setProfileImage] = useState("");
//     const [loading, setLoading] = useState(true);

//     useEffect(() => {
//         const loadDashboard = async () => {
//             try {
//                 const currentUser = await getCurrentUser();

//                 if (!currentUser) {
//                     window.location.href = "/login";
//                     return;
//                 }

//                 setUser(currentUser);

//                 const currentMember =
//                     await getCurrentMember(currentUser.$id);

//                 if (
//                     currentMember &&
//                     currentMember.role !== "professional"
//                 ) {
//                     window.location.href = "/dashboard";
//                     return;
//                 }

//                 setMember(currentMember);

//                 if (currentMember?.profileImage) {
//                     setProfileImage(
//                         getProfileImageUrl(
//                             currentMember.profileImage
//                         )
//                     );
//                 }
//             } catch (error) {
//                 console.error(
//                     "Professional dashboard error:",
//                     error
//                 );

//                 window.location.href = "/login";
//             } finally {
//                 setLoading(false);
//             }
//         };

//         loadDashboard();
//     }, []);

//     const handleLogout = async () => {
//         const result = await Swal.fire({
//             title: "Logout?",
//             text: "Are you sure you want to logout?",
//             icon: "warning",
//             showCancelButton: true,
//             confirmButtonText: "Yes, Logout",
//             cancelButtonText: "Cancel",
//         });

//         if (!result.isConfirmed) return;

//         try {
//             await logoutAccount();

//             localStorage.removeItem("token");

//             document.cookie =
//                 "token=; path=/; max-age=0";

//             await Swal.fire({
//                 title: "Logged Out",
//                 text: "You have been logged out successfully.",
//                 icon: "success",
//                 confirmButtonText: "OK",
//             });

//             window.location.href = "/login";
//         } catch (error) {
//             console.error("Logout error:", error);

//             Swal.fire(
//                 "Error",
//                 "Unable to logout. Please try again.",
//                 "error"
//             );
//         }
//     };

//     if (loading) {
//         return (
//             <div className="min-h-screen bg-slate-950 flex items-center justify-center">
//                 <div className="text-white text-lg">
//                     Loading Professional Dashboard...
//                 </div>
//             </div>
//         );
//     }

//     return (
//         <div className="min-h-screen bg-slate-950 text-white">

//             {/* Navbar */}
//             <header className="border-b border-slate-800 bg-slate-900">
//                 <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">

//                     <div>
//                         <h1 className="text-xl font-bold">
//                             HomeMate
//                         </h1>

//                         <p className="text-xs text-slate-400">
//                             Professional Dashboard
//                         </p>
//                     </div>

//                     <div className="flex items-center gap-4">

//                         {profileImage ? (
//                             <img
//                                 src={profileImage}
//                                 alt="Profile"
//                                 className="w-10 h-10 rounded-full object-cover border border-slate-700"
//                             />
//                         ) : (
//                             <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
//                                 {(
//                                     user?.name ||
//                                     member?.fullName ||
//                                     "P"
//                                 )
//                                     .charAt(0)
//                                     .toUpperCase()}
//                             </div>
//                         )}

//                         <div className="hidden sm:block">
//                             <p className="text-sm font-medium">
//                                 {user?.name ||
//                                     member?.fullName ||
//                                     "Professional"}
//                             </p>

//                             <p className="text-xs text-slate-400">
//                                 Professional
//                             </p>
//                         </div>

//                         <button
//                             onClick={handleLogout}
//                             className="bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-medium transition"
//                         >
//                             Logout
//                         </button>

//                     </div>
//                 </div>
//             </header>

//             {/* Main */}
//             <main className="max-w-7xl mx-auto px-6 py-10">

//                 <div className="mb-10">
//                     <p className="text-blue-400 text-sm mb-2">
//                         Professional Workspace
//                     </p>

//                     <h2 className="text-3xl md:text-4xl font-bold">
//                         Welcome,{" "}
//                         {user?.name ||
//                             member?.fullName ||
//                             "Professional"}
//                     </h2>

//                     <p className="text-slate-400 mt-2">
//                         Manage your services, bookings,
//                         service area and customer communication.
//                     </p>
//                 </div>

//                 {/* Stats */}
//                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">

//                     <div className="bg-slate-900 border border-slate-800 p-6">
//                         <p className="text-slate-400 text-sm">
//                             Role
//                         </p>

//                         <h3 className="text-xl font-semibold mt-2">
//                             Professional
//                         </h3>
//                     </div>

//                     <div className="bg-slate-900 border border-slate-800 p-6">
//                         <p className="text-slate-400 text-sm">
//                             Profile Completion
//                         </p>

//                         <h3 className="text-xl font-semibold mt-2">
//                             {member?.profileCompletion ?? 0}%
//                         </h3>
//                     </div>

//                     <div className="bg-slate-900 border border-slate-800 p-6">
//                         <p className="text-slate-400 text-sm">
//                             Verification
//                         </p>

//                         <h3 className="text-xl font-semibold mt-2">
//                             {member?.verificationStatus ||
//                                 "Pending"}
//                         </h3>
//                     </div>

//                     <div className="bg-slate-900 border border-slate-800 p-6">
//                         <p className="text-slate-400 text-sm">
//                             Account
//                         </p>

//                         <h3 className="text-xl font-semibold mt-2">
//                             Active
//                         </h3>
//                     </div>

//                 </div>

//                 {/* Professional Management */}
//                 <section className="mb-10">

//                     <div className="mb-5">
//                         <h3 className="text-xl font-semibold">
//                             Professional Management
//                         </h3>

//                         <p className="text-slate-400 text-sm mt-1">
//                             Manage your professional profile and
//                             services.
//                         </p>
//                     </div>

//                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

//                         <DashboardCard
//                             title="My Profile"
//                             description="View and update your professional profile."
//                             href="/dashboard/profile"
//                             icon="👤"
//                         />

//                         <DashboardCard
//                             title="My Services"
//                             description="Create and manage your services."
//                             href="/dashboard/professionals/services"
//                             icon="🛠️"
//                         />

//                         <DashboardCard
//                             title="Service Area"
//                             description="Manage the locations where you provide services."
//                             href="/dashboard/professionals/service-area"
//                             icon="📍"
//                         />

//                     </div>
//                 </section>

//                 {/* Bookings */}
//                 <section className="mb-10">

//                     <div className="mb-5">
//                         <h3 className="text-xl font-semibold">
//                             Booking Management
//                         </h3>

//                         <p className="text-slate-400 text-sm mt-1">
//                             Manage customer service requests.
//                         </p>
//                     </div>

//                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

//                         <DashboardCard
//                             title="Incoming Bookings"
//                             description="View new customer booking requests."
//                             href="/dashboard/bookings"
//                             icon="📋"
//                         />

//                         <DashboardCard
//                             title="Booking Management"
//                             description="Accept, process and complete bookings."
//                             href="/dashboard/bookings"
//                             icon="📅"
//                         />

//                         <DashboardCard
//                             title="Notifications"
//                             description="View booking and system notifications."
//                             href="/dashboard/notifications"
//                             icon="🔔"
//                         />

//                     </div>
//                 </section>

//                 {/* Communication */}
//                 <section>

//                     <div className="mb-5">
//                         <h3 className="text-xl font-semibold">
//                             Communication
//                         </h3>

//                         <p className="text-slate-400 text-sm mt-1">
//                             Stay connected with your customers.
//                         </p>
//                     </div>

//                     <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

//                         <DashboardCard
//                             title="Messages"
//                             description="Chat with customers about their services and bookings."
//                             href="/dashboard/messages"
//                             icon="💬"
//                         />

//                         <DashboardCard
//                             title="Verification"
//                             description="View your professional verification status."
//                             href="/dashboard/verification"
//                             icon="🛡️"
//                         />

//                     </div>
//                 </section>

//             </main>
//         </div>
//     );
// }

// function DashboardCard({
//     title,
//     description,
//     href,
//     icon,
// }: {
//     title: string;
//     description: string;
//     href: string;
//     icon: string;
// }) {
//     return (
//         <Link
//             href={href}
//             className="group bg-slate-900 border border-slate-800 p-6 hover:border-blue-500 hover:bg-slate-800 transition"
//         >
//             <div className="flex items-start justify-between">

//                 <div>
//                     <div className="text-3xl mb-4">
//                         {icon}
//                     </div>

//                     <h4 className="font-semibold text-lg group-hover:text-blue-400 transition">
//                         {title}
//                     </h4>

//                     <p className="text-sm text-slate-400 mt-2">
//                         {description}
//                     </p>
//                 </div>

//                 <span className="text-slate-500 group-hover:text-blue-400 transition">
//                     →
//                 </span>

//             </div>
//         </Link>
//     );
// }