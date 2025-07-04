export default async function handler(req, res) {
  const { error } = req.query;
  
  // Log the error for debugging
  console.error('NextAuth Error:', error);
  
  // Redirect to admin login page with error message
  // This ensures the error is displayed on the login page where users expect it
  const errorMessage = encodeURIComponent(error || 'Authentication failed');
  return res.redirect(`/admin/login?auth_error=${errorMessage}`);
} 