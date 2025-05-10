"use client";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
/** TODO
 * Add ShadCN forms (comes with pre-built zod integration)
 * OR add zod validations
 */
import { useRef } from "react";

const Signin = () => {
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const loginHandler = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = emailRef.current!.value;
    const password = passwordRef.current!.value;
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.ok) router.push("/dashboard");
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <form onSubmit={loginHandler}>
      <h2>Sign In</h2>
      <input type="email" placeholder="Email" ref={emailRef} />
      <input type="password" placeholder="Password" ref={passwordRef} />
      <button type="submit">Login</button>
      Don&apos;t have an account?<Link href="/auth/signup">Signup</Link>
    </form>
  );
};

export default Signin;
