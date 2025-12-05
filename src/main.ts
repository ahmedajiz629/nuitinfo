import './style.css'
import {
  AbstractMesh,
  Animation,
  ArcRotateCamera,
  Color3,
  Color4,
  Engine,
  GlowLayer,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PointerEventTypes,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from 'babylonjs'

// Quiz data ---------------------------------------------------------------

type Question = {
  title: string
  detail: string
  choices: [string, string]
  correct: 0 | 1
  explanation: string
}

const QUESTIONS: Question[] = [
  {
    title: 'Parc informatique en fin de vie',
    detail: 'Que fait l’établissement pour éviter de tout racheter sous licence propriétaire ?',
    choices: ['Réemploi + Linux via ateliers élèves-profs', 'Location clé en main verrouillée Big Tech'],
    correct: 0,
    explanation: 'Réemployer avec Linux garde la maîtrise du matériel, crée des compétences et réduit l’empreinte.',
  },
  {
    title: 'Cloud pédagogique',
    detail: 'Comment stocker les données du collège ?',
    choices: ['Choisir un commun local (Forge / Nextcloud public)', 'Souscrire à un cloud privé américain'],
    correct: 0,
    explanation: 'Les communs locaux garantissent la souveraineté, la réversibilité et limitent la captation des données.',
  },
  {
    title: 'Formation des équipes',
    detail: 'Quel dispositif renforce le Village NIRD ?',
    choices: ['Cercles de pair à pair + temps dédié aux communs', 'Tutoriels marketing fournis par l’éditeur'],
    correct: 0,
    explanation: 'Former par les pairs développe l’autonomie et la capacité à adapter les outils libres.',
  },
  {
    title: 'Équipement des élèves',
    detail: 'Comment préserver l’inclusion numérique ?',
    choices: ['Mutualiser des postes légers reconditionnés', 'Imposer des tablettes propriétaires coûteuses'],
    correct: 0,
    explanation: 'Le reconditionné mutualisé permet l’accès pour tous, réduit les coûts et respecte la sobriété.',
  },
]

// Babylon bootstrap ------------------------------------------------------

const canvas = document.createElement('canvas')
canvas.id = 'renderCanvas'
document.querySelector<HTMLDivElement>('#app')?.appendChild(canvas)

const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true })
const { scene, doors } = createScene(engine, canvas)
const hud = setupHud()
initializeQuiz(doors, hud, scene)

engine.runRenderLoop(() => scene.render())
window.addEventListener('resize', () => engine.resize())

function createScene(engine: Engine, canvas: HTMLCanvasElement) {
  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.01, 0.02, 0.05, 1)

  const camera = new ArcRotateCamera('camera', -Math.PI / 2.6, Math.PI / 3, 12, new Vector3(0, 2, 0), scene)
  camera.attachControl(canvas, true)
  camera.panningSensibility = 0
  camera.lowerRadiusLimit = 8
  camera.upperRadiusLimit = 15

  const light = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene)
  light.intensity = 0.95

  const ground = MeshBuilder.CreateGround('ground', { width: 26, height: 26 }, scene)
  const groundMat = new StandardMaterial('groundMat', scene)
  groundMat.diffuseColor = new Color3(0.02, 0.03, 0.06)
  groundMat.specularColor = Color3.Black()
  ground.material = groundMat

  const walkway = MeshBuilder.CreateBox('walkway', { width: 4, height: 0.2, depth: 12 }, scene)
  walkway.position = new Vector3(0, 0.1, 0)
  const walkwayMat = new StandardMaterial('walkwayMat', scene)
  walkwayMat.diffuseColor = new Color3(0.05, 0.08, 0.14)
  walkwayMat.emissiveColor = new Color3(0.2, 0.5, 0.6)
  walkway.material = walkwayMat

  new GlowLayer('glow', scene).intensity = 0.8

  const leftDoor = createDoor(scene, {
    id: 'left',
    position: new Vector3(-2.2, 0, 0),
    direction: 1,
    color: new Color3(0.6, 0.38, 1),
  })
  const rightDoor = createDoor(scene, {
    id: 'right',
    position: new Vector3(2.2, 0, 0),
    direction: -1,
    color: new Color3(0.25, 0.8, 0.7),
  })

  createDataStream(scene)

  return { scene, doors: [leftDoor, rightDoor] }
}

// HUD references ---------------------------------------------------------

type HudRefs = {
  progress: HTMLElement
  score: HTMLElement
  title: HTMLElement
  detail: HTMLElement
  optionLeft: HTMLElement
  optionRight: HTMLElement
  feedback: HTMLElement
  nextBtn: HTMLButtonElement
  summary: HTMLElement
  summaryText: HTMLElement
}

function setupHud(): HudRefs {
  return {
    progress: document.querySelector('[data-hud="progress"]')!,
    score: document.querySelector('[data-hud="score"]')!,
    title: document.querySelector('[data-hud="question-title"]')!,
    detail: document.querySelector('[data-hud="question-detail"]')!,
    optionLeft: document.querySelector('[data-hud="option-left"]')!,
    optionRight: document.querySelector('[data-hud="option-right"]')!,
    feedback: document.querySelector('[data-hud="feedback"]')!,
    nextBtn: document.querySelector('[data-action="next"]')!,
    summary: document.querySelector('[data-hud="summary"]')!,
    summaryText: document.querySelector('[data-hud="summary-text"]')!,
  }
}

// Quiz runtime -----------------------------------------------------------

type DoorRig = {
  id: 'left' | 'right'
  hinge: TransformNode
  panel: Mesh
  mat: StandardMaterial
  direction: number
  baseColor: Color3
}

function initializeQuiz(doors: DoorRig[], hud: HudRefs, scene: Scene) {
  let current = 0
  let score = 0
  let locked = false
  let summaryMode = false

  loadQuestion(current)

  scene.onPointerObservable.add((pointerInfo) => {
    if (pointerInfo.type !== PointerEventTypes.POINTERUP || locked || summaryMode) return
    const picked = pointerInfo.pickInfo?.pickedMesh
    if (!picked) return
    const doorId = extractDoorId(picked)
    if (!doorId) return
    handleChoice(doorId === 'left' ? 0 : 1)
  })

  hud.nextBtn.addEventListener('click', () => {
    if (hud.nextBtn.dataset.mode === 'restart') {
      summaryMode = false
      score = 0
      current = 0
      loadQuestion(current)
      return
    }

    if (current >= QUESTIONS.length - 1) {
      showSummary()
    } else {
      current += 1
      loadQuestion(current)
    }
  })

  function handleChoice(choiceIndex: 0 | 1) {
    const question = QUESTIONS[current]
    const door = doors[choiceIndex]
    locked = true
    const isCorrect = question.correct === choiceIndex
    if (isCorrect) {
      score += 1
    }
    animateDoor(door, isCorrect ? Math.PI / 1.6 : Math.PI / 4).then(() => {
      if (!isCorrect) {
        animateDoor(door, 0, 50)
      }
    })
    styleDoorsAfterAnswer(choiceIndex, isCorrect)
    updateFeedback(isCorrect, question.explanation)
    hud.score.textContent = `Score ${score}`
    hud.nextBtn.disabled = false
    hud.nextBtn.textContent = current >= QUESTIONS.length - 1 ? 'Voir les résultats' : 'Question suivante'
  }

  function styleDoorsAfterAnswer(selected: number, correct: boolean) {
    doors.forEach((door, index) => {
      const success = index === QUESTIONS[current].correct
      door.mat.emissiveColor = success ? new Color3(0.2, 0.95, 0.7) : new Color3(0.8, 0.2, 0.2)
      if (index === selected && !correct) {
        door.mat.emissiveColor = new Color3(1, 0.35, 0.2)
      }
    })
  }

  function loadQuestion(index: number) {
    const question = QUESTIONS[index]
    locked = false
    hud.summary.hidden = true
    hud.summaryText.textContent = ''
    hud.nextBtn.disabled = true
    hud.nextBtn.dataset.mode = 'question'
    hud.nextBtn.textContent = 'Question suivante'
    hud.progress.textContent = `Question ${index + 1} / ${QUESTIONS.length}`
    hud.score.textContent = `Score ${score}`
    hud.title.textContent = question.title
    hud.detail.textContent = question.detail
    hud.optionLeft.textContent = question.choices[0]
    hud.optionRight.textContent = question.choices[1]
    hud.feedback.textContent = 'Choisis une porte pour tenter ta chance.'
    hud.feedback.className = 'feedback'
    summaryMode = false
    resetDoors(doors)
    doors.forEach((door) => {
      door.mat.emissiveColor = door.baseColor
    })
  }

  function showSummary() {
    summaryMode = true
    hud.summary.hidden = false
    const ratio = `${score} / ${QUESTIONS.length}`
    hud.summaryText.textContent = `Tu obtiens ${ratio}. Continue à ouvrir des portes vers des communs numériques pour atteindre 100 %.`
    hud.nextBtn.disabled = false
    hud.nextBtn.textContent = 'Rejouer la scène'
    hud.nextBtn.dataset.mode = 'restart'
    hud.feedback.textContent = 'Défi terminé : explore les ressources NIRD pour aller plus loin.'
    hud.feedback.className = 'feedback success'
  }

  function updateFeedback(success: boolean, explanation: string) {
    hud.feedback.textContent = success ? `Bravo ! ${explanation}` : `Oups… ${explanation}`
    hud.feedback.className = `feedback ${success ? 'success' : 'error'}`
  }

  function animateDoor(door: DoorRig, angle: number, speed = 30) {
    return new Promise<void>((resolve) => {
      scene.stopAnimation(door.hinge)
      Animation.CreateAndStartAnimation(
        `door-${door.id}`,
        door.hinge,
        'rotation.y',
        60,
        speed,
        door.hinge.rotation.y,
        door.direction * angle,
        Animation.ANIMATIONLOOPMODE_CONSTANT,
        undefined,
        () => resolve(),
      )
    })
  }
}

// Door helpers -----------------------------------------------------------

function createDoor(
  scene: Scene,
  config: { id: 'left' | 'right'; position: Vector3; direction: number; color: Color3 },
): DoorRig {
  const hinge = new TransformNode(`${config.id}-hinge`, scene)
  hinge.position = config.position

  const panel = MeshBuilder.CreateBox(`${config.id}-door`, { width: 1.6, height: 4.2, depth: 0.25 }, scene)
  panel.parent = hinge
  panel.position = new Vector3(config.direction * 0.8, 2.1, 0)
  const mat = new StandardMaterial(`${config.id}-mat`, scene)
  mat.diffuseColor = new Color3(0.05, 0.08, 0.12)
  mat.emissiveColor = config.color
  mat.specularColor = Color3.Black()
  panel.material = mat
  panel.metadata = { door: config.id }

  const frame = MeshBuilder.CreateBox(`${config.id}-frame`, { width: 2, height: 4.5, depth: 0.1 }, scene)
  frame.position = config.position.add(new Vector3(0, 2.1, 0))
  const frameMat = new StandardMaterial(`${config.id}-frameMat`, scene)
  frameMat.emissiveColor = config.color.scale(0.4)
  frame.material = frameMat

  return {
    id: config.id,
    hinge,
    panel,
    mat,
    direction: config.direction,
    baseColor: config.color,
  }
}

function resetDoors(doors: DoorRig[]) {
  doors.forEach((door) => {
    door.hinge.rotation.y = 0
  })
}

function extractDoorId(mesh: AbstractMesh | null) {
  if (!mesh) return null
  if (mesh.metadata?.door) {
    return mesh.metadata.door as 'left' | 'right'
  }
  const parent = mesh.parent as AbstractMesh | null
  if (parent?.metadata?.door) {
    return parent.metadata.door as 'left' | 'right'
  }
  return null
}

// Ambient elements ------------------------------------------------------

function createDataStream(scene: Scene) {
  const ribbon = MeshBuilder.CreateRibbon(
    'data-stream',
    {
      pathArray: [
        Array.from({ length: 20 }, (_, i) => new Vector3(-6 + i * 0.6, 1.2 + Math.sin(i * 0.4) * 0.2, -4)),
        Array.from({ length: 20 }, (_, i) => new Vector3(-6 + i * 0.6, 1.6 + Math.cos(i * 0.3) * 0.2, -4.2)),
      ],
      closePath: false,
      closeArray: false,
    },
    scene,
  )
  const mat = new StandardMaterial('stream', scene)
  mat.emissiveColor = new Color3(0.2, 0.7, 0.9)
  mat.alpha = 0.4
  ribbon.material = mat
}
