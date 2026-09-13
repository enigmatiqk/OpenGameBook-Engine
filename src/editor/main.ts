import './styles.css'
import { EditorApp } from './EditorApp'

const root = document.getElementById('editor-root')
if (!root) throw new Error('Élément #editor-root introuvable dans editor.html')

const app = new EditorApp(root)
app.init().catch((err: unknown) => {
  console.error('[editor] Init failed:', err)
  root.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:1rem;color:#e94560;">
      <div style="font-size:3rem">⚠️</div>
      <p>Impossible d'initialiser l'éditeur.</p>
      <pre style="font-size:0.75rem;color:#a0a0b0;">${String(err)}</pre>
    </div>
  `
})
