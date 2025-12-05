import './style.css'
import {
  ArcRotateCamera,
  Color3,
  Color4,
  DynamicTexture,
  Engine,
  GlowLayer,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from 'babylonjs'

type Mood = 'goliath' | 'village'

const canvas = document.createElement('canvas')
canvas.id = 'renderCanvas'
const root = document.querySelector<HTMLDivElement>('#app')
root?.appendChild(canvas)

const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true })
const scene = createScene(engine, canvas)
engine.runRenderLoop(() => scene.render())

window.addEventListener('resize', () => {
  engine.resize()
})

function createScene(engine: Engine, canvas: HTMLCanvasElement) {
  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.02, 0.02, 0.05, 1)

  const camera = new ArcRotateCamera('camera', -Math.PI / 2.4, Math.PI / 3, 13, new Vector3(0, 2, 0), scene)
  camera.attachControl(canvas, true)
  camera.panningSensibility = 0

  const light = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene)
  light.intensity = 0.9

  const ground = MeshBuilder.CreateGround('ground', { width: 24, height: 24 }, scene)
  const groundMat = new StandardMaterial('groundMat', scene)
  groundMat.diffuseColor = new Color3(0.03, 0.04, 0.08)
  groundMat.specularColor = Color3.Black()
  ground.material = groundMat

  const walkway = MeshBuilder.CreateBox('walkway', { width: 4, height: 0.2, depth: 10 }, scene)
  walkway.position = new Vector3(0, 0.1, 0)
  const walkwayMat = new StandardMaterial('walkwayMat', scene)
  walkwayMat.emissiveColor = new Color3(0.6, 0.2, 0.2)
  walkwayMat.diffuseColor = new Color3(0.1, 0.05, 0.2)
  walkway.material = walkwayMat

  const frame = MeshBuilder.CreateBox('frame', { height: 5, width: 3, depth: 0.3 }, scene)
  frame.position = new Vector3(0, 2.5, 0)
  const frameMat = new StandardMaterial('frameMat', scene)
  frameMat.diffuseColor = new Color3(0.05, 0.12, 0.2)
  frameMat.emissiveColor = new Color3(0.05, 0.17, 0.3)
  frame.material = frameMat

  const portal = MeshBuilder.CreatePlane('portal', { width: 2.4, height: 4.2 }, scene)
  portal.position = new Vector3(0, 2.4, 0.16)
  const portalMat = new StandardMaterial('portalMat', scene)
  portalMat.backFaceCulling = false
  portalMat.emissiveColor = new Color3(0.2, 0.5, 0.9)
  portal.material = portalMat

  const portalTex = new DynamicTexture('portalTexture', { width: 512, height: 512 }, scene, true)
  portalMat.diffuseTexture = portalTex
  portalMat.opacityTexture = portalTex
  const portalCtx = portalTex.getContext() as CanvasRenderingContext2D | null
  if (!portalCtx) {
    throw new Error('Unable to create portal texture context')
  }

  const glow = new GlowLayer('glow', scene)
  glow.intensity = 0.7

  const orbs = createDataOrbs(scene)

  const moods: Record<Mood, MoodRecipe> = {
    goliath: {
      name: 'Goliath mode',
      copy: 'A closed, extractive stack. Heavy fumes and aggressive colors dominate the door.',
      clear: new Color4(0.03, 0.02, 0.07, 1),
      walkway: new Color3(0.6, 0.15, 0.15),
      frame: new Color3(0.08, 0.18, 0.35),
      portal: new Color3(0.9, 0.4, 0.3),
      meters: { sobriety: 30, inclusion: 45, autonomy: 20 },
      swirl: ['#ff8833', '#4a0a14', '#1a0204'],
    },
    village: {
      name: 'Village NIRD',
      copy: 'Open, repairable and creative. Softer tones reveal the resilient commons beyond the door.',
      clear: new Color4(0.01, 0.05, 0.07, 1),
      walkway: new Color3(0.1, 0.4, 0.35),
      frame: new Color3(0.15, 0.45, 0.55),
      portal: new Color3(0.2, 0.9, 0.7),
      meters: { sobriety: 85, inclusion: 80, autonomy: 90 },
      swirl: ['#8af1ff', '#1f6f72', '#092324'],
    },
  }

  let phase = 0
  let currentMood: Mood = 'goliath'
  const hud = setupHud()

  applyMood(currentMood)

  scene.registerBeforeRender(() => {
    phase += 0.01
    portal.rotation.y = 0.1 * Math.sin(phase * 0.6)
    portal.rotation.z = 0.05 * Math.cos(phase * 0.4)
    drawSwirl(portalCtx, portalTex, moods[currentMood].swirl, phase)
    orbs.forEach((orb, index) => {
      orb.mesh.rotation.y += 0.01 + index * 0.002
      orb.mesh.position.y = 1.5 + Math.sin(phase * 2 + index) * 0.3
    })
  })

  scene.onPointerObservable.add((pointerInfo) => {
    if (pointerInfo.pickInfo?.hit && pointerInfo.pickInfo.pickedMesh === portal) {
      currentMood = currentMood === 'goliath' ? 'village' : 'goliath'
      applyMood(currentMood)
    }
  })

  hud.buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.state as Mood
      currentMood = target
      applyMood(target)
    })
  })

  function applyMood(mood: Mood) {
    const recipe = moods[mood]
    scene.clearColor = recipe.clear
    walkwayMat.emissiveColor = recipe.walkway
    frameMat.emissiveColor = recipe.frame
    frameMat.diffuseColor = recipe.frame.scale(0.6)
    portalMat.emissiveColor = recipe.portal
    glow.intensity = mood === 'village' ? 1.2 : 0.6
    updateMeters(recipe.meters)
    hud.description.innerText = recipe.copy
    hud.title.innerText = recipe.name
    hud.buttons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.state === mood)
    })
  }

  return scene
}

type MoodRecipe = {
  name: string
  copy: string
  clear: Color4
  walkway: Color3
  frame: Color3
  portal: Color3
  meters: Record<'sobriety' | 'inclusion' | 'autonomy', number>
  swirl: [string, string, string]
}

type Orb = { mesh: Mesh }

function drawSwirl(
  ctx: CanvasRenderingContext2D,
  tex: DynamicTexture,
  palette: [string, string, string],
  phase: number,
) {
  const size = tex.getSize().width
  ctx.clearRect(0, 0, size, size)
  const gradient = ctx.createRadialGradient(256, 256, 20, 256, 256, 256)
  gradient.addColorStop(0, palette[0])
  gradient.addColorStop(0.5 + 0.1 * Math.sin(phase), palette[1])
  gradient.addColorStop(1, palette[2])
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let angle = 0; angle < Math.PI * 4; angle += 0.2) {
    const radius = 40 + angle * 12
    const x = 256 + Math.cos(angle + phase) * radius
    const y = 256 + Math.sin(angle + phase) * radius
    ctx.lineTo(x, y)
  }
  ctx.stroke()
  tex.update(true)
}

function createDataOrbs(scene: Scene): Orb[] {
  const orbs: Orb[] = []
  const orbMat = new StandardMaterial('orbMat', scene)
  orbMat.emissiveColor = new Color3(0.6, 0.8, 1)
  for (let i = 0; i < 5; i++) {
    const mesh = MeshBuilder.CreateSphere(`orb-${i}`, { diameter: 0.4 }, scene)
    mesh.position = new Vector3(-3 + i * 1.5, 1.5 + Math.random() * 1.5, -2 + Math.random() * 4)
    mesh.material = orbMat
    orbs.push({ mesh })
  }
  return orbs
}

function setupHud() {
  const title = document.querySelector<HTMLHeadingElement>('[data-hud="title"]')!
  const description = document.querySelector<HTMLParagraphElement>('[data-hud="description"]')!
  const meters = document.querySelectorAll<HTMLDivElement>('[data-meter] .fill')
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-state]')
  return { title, description, meters, buttons }
}

function updateMeters(values: Record<'sobriety' | 'inclusion' | 'autonomy', number>) {
  Object.entries(values).forEach(([key, value]) => {
    const meter = document.querySelector<HTMLDivElement>(`[data-meter="${key}"] .fill`)
    if (meter) {
      meter.style.width = `${value}%`
      meter.dataset.value = `${value}`
    }
  })
}
