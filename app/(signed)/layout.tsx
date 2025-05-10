"use client";
import React, { ReactElement } from "react";

const SignedLayout = ({ children }: { children: ReactElement }) => {
  return (
    <>
      <div>Navbar</div>
      <main>{children}</main>
      <div>Footer</div>
    </>
  );
};

export default SignedLayout;
