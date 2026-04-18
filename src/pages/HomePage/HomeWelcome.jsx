export default function HomeWelcome() {
  return (
    <div className="space-y-4 text-center">
      <p className="text-sm tracking-[0.35em] text-muted-foreground uppercase">
        Welcome to
      </p>
      <h1 className="animate-gradient bg-linear-to-r from-blue-600 via-purple-600 to-indigo-600 bg-size-[200%] bg-clip-text text-4xl font-semibold tracking-tight text-transparent">
        IVR Pro Tools
      </h1>
      <p className="mx-auto max-w-2xl text-base leading-7 text-muted-foreground">
        A lightweight utility suite for normalizing text, preparing Excel
        content, and generating audio-friendly output.
      </p>
    </div>
  )
}
