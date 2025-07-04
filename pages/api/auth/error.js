export default async function handler(req, res) {
  const { error } = req.query;
  
  // Log the error for debugging
  console.error('NextAuth Error:', error);
  
  // Redirect to a more user-friendly error page or back to sign-in
  if (error === 'Callback') {
    // Callback error - likely configuration issue
    console.error('Callback error detected. Check NEXTAUTH_URL and Google OAuth configuration.');
    return res.redirect('/api/auth/signin?error=Configuration');
  }
  
  // For other errors, redirect to sign-in with error message
  return res.redirect(`/api/auth/signin?error=${error || 'Unknown'}`);
} 