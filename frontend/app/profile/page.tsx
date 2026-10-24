
"use client";

import { useEffect, useState } from "react";

export default function ProfilePage() {
  const [profile, setProfile] = useState<{
    id?: string;
    email?: string;
    name?: string;
  } | null>(null);

  const [message, setMessage] = useState("Loading profile...");

  useEffect(() => {
    async function getProfile() {
      const token = localStorage.getItem("token");

      if (!token) {
        setMessage("Please login first.");
        return;
      }

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/profile`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          setMessage(data.message || "Unable to load profile.");
          return;
        }

        setProfile(data.user);
        setMessage("Profile loaded successfully!");
      } catch (error) {
        console.error(error);
        setMessage("Could not connect to the server.");
      }
    }

    getProfile();
  }, []);

  return (
    <main className="login-page">
      <div className="login-card">
        <h1>My Profile</h1>
        <p>{message}</p>

        {profile && (
          <div>
            <p>Name: {profile.name || "Not available"}</p>
            <p>Email: {profile.email || "Not available"}</p>
            <p>ID: {profile.id || "Not available"}</p>
          </div>
        )}
      </div>
    </main>
  );
}
