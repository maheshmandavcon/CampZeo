import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function YouTubeTestPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/sign-in");
  }

  // Get user from database
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: {
      email: true,
      clerkId: true,
      youtubeAccessToken: true,
      youtubeAuthUrn: true,
    },
  });

  // Get YouTube config
  const youtubeClientId = await prisma.adminPlatformConfiguration.findFirst({
    where: { key: "YOUTUBE_CLIENT_ID" },
  });

  const youtubeClientSecret = await prisma.adminPlatformConfiguration.findFirst({
    where: { key: "YOUTUBE_CLIENT_SECRET" },
  });

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">YouTube OAuth Diagnostic</h1>

      <div className="space-y-6">
        {/* User Info */}
        <div className="border rounded-lg p-6 bg-white shadow-sm">
          <h2 className="text-xl font-semibold mb-4">User Information</h2>
          <div className="space-y-2 font-mono text-sm">
            <div>
              <span className="font-bold">Email:</span> {user?.email}
            </div>
            <div>
              <span className="font-bold">Clerk ID:</span> {userId}
            </div>
            <div>
              <span className="font-bold">YouTube Access Token:</span>{" "}
              {user?.youtubeAccessToken ? (
                <span className="text-green-600">
                  ✅ SET ({user.youtubeAccessToken.substring(0, 30)}...)
                </span>
              ) : (
                <span className="text-red-600">❌ NULL</span>
              )}
            </div>
            <div>
              <span className="font-bold">YouTube Refresh Token:</span>{" "}
              {user?.youtubeAuthUrn ? (
                <span className="text-green-600">
                  ✅ SET ({user.youtubeAuthUrn.substring(0, 30)}...)
                </span>
              ) : (
                <span className="text-red-600">❌ NULL</span>
              )}
            </div>
          </div>
        </div>

        {/* YouTube Config */}
        <div className="border rounded-lg p-6 bg-white shadow-sm">
          <h2 className="text-xl font-semibold mb-4">YouTube Configuration</h2>
          <div className="space-y-2 font-mono text-sm">
            <div>
              <span className="font-bold">Client ID:</span>{" "}
              {youtubeClientId?.value ? (
                <span className="text-green-600">
                  ✅ SET ({youtubeClientId.value.substring(0, 20)}...)
                </span>
              ) : (
                <span className="text-red-600">❌ NOT SET</span>
              )}
            </div>
            <div>
              <span className="font-bold">Client Secret:</span>{" "}
              {youtubeClientSecret?.value ? (
                <span className="text-green-600">✅ SET (hidden)</span>
              ) : (
                <span className="text-red-600">❌ NOT SET</span>
              )}
            </div>
          </div>
        </div>

        {/* OAuth URLs */}
        <div className="border rounded-lg p-6 bg-white shadow-sm">
          <h2 className="text-xl font-semibold mb-4">OAuth URLs</h2>
          <div className="space-y-3">
            <div>
              <p className="font-bold mb-1">Auth URL Endpoint:</p>
              <code className="block bg-gray-100 p-2 rounded text-sm">
                /api/socialmedia/auth-url?platform=YOUTUBE
              </code>
            </div>
            <div>
              <p className="font-bold mb-1">Callback URL:</p>
              <code className="block bg-gray-100 p-2 rounded text-sm">
                http://localhost:3000/auth-callback
              </code>
            </div>
            <div>
              <p className="font-bold mb-1">State Parameter:</p>
              <code className="block bg-gray-100 p-2 rounded text-sm">
                YOUTUBE_{userId}
              </code>
            </div>
          </div>
        </div>

        {/* Test Button */}
        <div className="border rounded-lg p-6 bg-white shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Test OAuth Flow</h2>
          <p className="text-sm text-gray-600 mb-4">
            Click the button below to initiate the YouTube OAuth flow. Check your terminal logs for detailed information.
          </p>
          <form action="/api/socialmedia/auth-url" method="GET">
            <input type="hidden" name="platform" value="YOUTUBE" />
            <button
              type="submit"
              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded"
            >
              🎥 Connect YouTube
            </button>
          </form>
        </div>

        {/* Instructions */}
        <div className="border rounded-lg p-6 bg-blue-50 border-blue-200">
          <h2 className="text-xl font-semibold mb-4">Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Verify that YouTube Client ID and Client Secret are set above</li>
            <li>Click "Connect YouTube" button</li>
            <li>Authorize with Google</li>
            <li>Watch your terminal for logs starting with 🔵</li>
            <li>After redirect, refresh this page to see if tokens are set</li>
          </ol>
        </div>

        {/* Expected Logs */}
        <div className="border rounded-lg p-6 bg-gray-50">
          <h2 className="text-xl font-semibold mb-4">Expected Terminal Logs</h2>
          <pre className="text-xs bg-black text-green-400 p-4 rounded overflow-x-auto">
{`🔵 OAuth Callback Received: { platform: 'YOUTUBE', stateUserId: '${userId?.substring(0, 10)}...', hasCode: true }
✅ User verified: { email: '${user?.email}' }
🔵 YouTube Token Exchange - Request: { tokenUrl: '...', redirectUri: '...', clientId: '...' }
🔵 YouTube Token Exchange - Response: { hasAccessToken: true, hasRefreshToken: true, expiresIn: 3600, error: undefined }
🔵 YouTube Update Data: { hasAccessToken: true, hasRefreshToken: true, accessTokenLength: 200+ }
🔵 Updating user: { clerkId: '${userId}', platform: 'YOUTUBE', updateFields: ['youtubeAccessToken', 'youtubeAuthUrn'] }
🔵 User updated successfully: { platform: 'YOUTUBE', youtubeAccessToken: 'SET', youtubeAuthUrn: 'SET' }`}
          </pre>
        </div>
      </div>
    </div>
  );
}
