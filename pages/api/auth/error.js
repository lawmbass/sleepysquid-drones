export default async function handler(req, res) {
  const { error } = req.query;
  
  // Log the error for debugging
  console.error('NextAuth Error:', error);
  
  // Instead of redirecting back to signin (which can cause loops),
  // redirect to home page with error message
  const errorMessage = encodeURIComponent(error || 'Authentication failed');
  return res.redirect(`/?auth_error=${errorMessage}`);
} 