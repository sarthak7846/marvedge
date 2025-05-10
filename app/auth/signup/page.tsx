"use client";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";

export default function SignUp() {
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = nameRef.current!.value;
    const email = emailRef.current!.value;
    const password = passwordRef.current!.value;

    try {
      const res = await axios.post("/api/auth/signup", {
        email,
        name,
        password,
      });
      console.log("signed up", res.data);

      router.push("/auth/signin");
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <form onSubmit={handleSignup}>
      <h2>Sign Up</h2>
      <input type="text" ref={nameRef} placeholder="Name" />
      <input type="email" ref={emailRef} placeholder="Email" />
      <input type="password" ref={passwordRef} placeholder="Password" />
      <button type="submit">Register</button>
      Already have an account?<Link href="/auth/signin">Signin</Link>
    </form>
  );
}
