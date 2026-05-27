import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'realtime-token-dev-endpoint',
      configureServer(server) {
        server.middlewares.use('/api/realtime-token', async (req, res) => {
          if (req.method !== 'GET') {
            res.statusCode = 405
            res.end(JSON.stringify({ error: 'Method not allowed' }))
            return
          }

          const apiKey = process.env.OPENAI_API_KEY
          if (!apiKey) {
            res.statusCode = 501
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Set OPENAI_API_KEY before using Realtime voice.' }))
            return
          }

          try {
            const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'OpenAI-Safety-Identifier': 'public-qa-chatbot-demo',
              },
              body: JSON.stringify({
                session: {
                  type: 'realtime',
                  model: 'gpt-realtime-2',
                  audio: {
                    input: {
                      transcription: {
                        model: 'gpt-4o-transcribe',
                      },
                      turn_detection: {
                        type: 'server_vad',
                      },
                    },
                    output: {
                      voice: 'marin',
                    },
                  },
                },
              }),
            })

            const text = await response.text()
            res.statusCode = response.status
            res.setHeader('Content-Type', response.headers.get('Content-Type') ?? 'application/json')
            res.end(text)
          } catch (error) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Failed to create Realtime token' }))
          }
        })
      },
    },
  ],
})
