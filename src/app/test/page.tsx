export default function TestPage() {
  return (
    <div className="min-h-screen bg-green-500 flex items-center justify-center">
      <div className="text-white text-center">
        <h1 className="text-4xl font-bold mb-4">TEST PAGE WORKS!</h1>
        <p className="text-xl">If you can see this, the deployment is working.</p>
        <p className="text-sm mt-4">Current time: {new Date().toISOString()}</p>
      </div>
    </div>
  );
}
