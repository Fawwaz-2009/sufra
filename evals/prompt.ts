// Promptfoo function-prompt: returns the chat messages array as a JSON string.
// promptfoo wants prompts as string / file-path / {raw,label}, not inline
// functions in the config, hence this small file.

export default function buildPrompt(input: {
  vars: { systemPrompt: string; userText: string; imageUrl: string }
}) {
  const { vars } = input
  return JSON.stringify([
    { role: "system", content: vars.systemPrompt },
    {
      role: "user",
      content: [
        { type: "text", text: vars.userText },
        { type: "image_url", image_url: { url: vars.imageUrl } },
      ],
    },
  ])
}
