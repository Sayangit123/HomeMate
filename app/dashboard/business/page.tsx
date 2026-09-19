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

// export default function BusinessDashboard() {
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
//                     currentMember.role !== "business"
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
//                     "Business dashboard error:",
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
//                     Loading Business Dashboard...
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
//                             Business Dashboard
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
//                                     "B"
//                                 )
//                                     .charAt(0)
//                                     .toUpperCase()}
//                             </div>
//                         )}

//                         <div className="hidden sm:block">
//                             <p className="text-sm font-medium">
//                                 {user?.name ||
//                                     member?.fullName ||
//                                     "Business"}
//                             </p>

//                             <p className="text-xs text-slate-400">
//                                 Business
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
//                         Business Workspace
//                     </p>

//                     <h2 className="text-3xl md:text-4xl font-bold">
//                         Welcome,{" "}
//                         {user?.name ||
//                             member?.fullName ||
//                             "Business"}
//                     </h2>

//                     <p className="text-slate-400 mt-2">
//                         Manage your products, customer orders
//                         and business communication.
//                     </p>
//                 </div>

//                 {/* Stats */}
//                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">

//                     <div className="bg-slate-900 border border-slate-800 p-6">
//                         <p className="text-slate-400 text-sm">
//                             Role
//                         </p>

//                         <h3 className="text-xl font-semibold mt-2">
//                             Business
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

//                 {/* Product Management */}
//                 <section className="mb-10">

//                     <div className="mb-5">
//                         <h3 className="text-xl font-semibold">
//                             Product Management
//                         </h3>

//                         <p className="text-slate-400 text-sm mt-1">
//                             Manage your marketplace products.
//                         </p>
//                     </div>

//                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

//                         <DashboardCard
//                             title="My Products"
//                             description="View and manage all your products."
//                             href="/dashboard/marketplace/products"
//                             icon="🛍️"
//                         />

//                         <DashboardCard
//                             title="Add Product"
//                             description="Add a new product to the marketplace."
//                             href="/dashboard/marketplace/products/add"
//                             icon="➕"
//                         />

//                         <DashboardCard
//                             title="Product Catalog"
//                             description="Browse and manage your marketplace catalog."
//                             href="/dashboard/marketplace"
//                             icon="📚"
//                         />

//                     </div>
//                 </section>

//                 {/* Orders */}
//                 <section className="mb-10">

//                     <div className="mb-5">
//                         <h3 className="text-xl font-semibold">
//                             Order Management
//                         </h3>

//                         <p className="text-slate-400 text-sm mt-1">
//                             Manage orders containing your products.
//                         </p>
//                     </div>

//                     <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

//                         <DashboardCard
//                             title="Customer Orders"
//                             description="View orders containing your products."
//                             href="/dashboard/marketplace/business-orders"
//                             icon="📦"
//                         />

//                         <DashboardCard
//                             title="Manage Order Status"
//                             description="Update order status and notify customers."
//                             href="/dashboard/marketplace/business-orders"
//                             icon="🔄"
//                         />

//                     </div>
//                 </section>

//                 {/* Communication */}
//                 <section>

//                     <div className="mb-5">
//                         <h3 className="text-xl font-semibold">
//                             Business Communication
//                         </h3>

//                         <p className="text-slate-400 text-sm mt-1">
//                             Stay connected with customers and
//                             manage notifications.
//                         </p>
//                     </div>

//                     <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

//                         <DashboardCard
//                             title="Customer Support"
//                             description="Communicate with customers."
//                             href="/dashboard/messages"
//                             icon="💬"
//                         />

//                         <DashboardCard
//                             title="Notifications"
//                             description="View order and system notifications."
//                             href="/dashboard/notifications"
//                             icon="🔔"
//                         />

//                         <DashboardCard
//                             title="Business Profile"
//                             description="View and manage your business profile."
//                             href="/dashboard/profile"
//                             icon="👤"
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