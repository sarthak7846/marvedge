import withAuth from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    authorized: ({ token }) => {
      console.log("MIDDLEWARE TOKEN:", token);
      return !!token;
    },
  },
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
