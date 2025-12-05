import './style.css'
import {
  AbstractMesh,
  Animation,
  ArcRotateCamera,
  Color3,
  Color4,
  DynamicTexture,
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

type AnswerLayout = {
  leftChoice: 0 | 1
  rightChoice: 0 | 1
}

const LEVELS: Question[][] = [
  [
    {
      title: 'Parc informatique en fin de vie',
      detail: 'Que fait l\'établissement pour éviter de tout racheter sous licence propriétaire ?',
      choices: ['Réemploi + Linux via ateliers élèves-profs', 'Location clé en main verrouillée Big Tech'],
      correct: 0,
      explanation: 'Réemployer avec Linux garde la maîtrise du matériel, crée des compétences et réduit l\'empreinte.',
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
      choices: ['Cercles de pair à pair + temps dédié aux communs', 'Tutoriels marketing fournis par l\'éditeur'],
      correct: 0,
      explanation: 'Former par les pairs développe l\'autonomie et la capacité à adapter les outils libres.',
    },
  ],
  [
    {
      title: 'Équipement des élèves',
      detail: 'Comment préserver l\'inclusion numérique ?',
      choices: ['Mutualiser des postes légers reconditionnés', 'Imposer des tablettes propriétaires coûteuses'],
      correct: 0,
      explanation: 'Le reconditionné mutualisé permet l\'accès pour tous, réduit les coûts et respecte la sobriété.',
    },
    {
      title: 'Service d\'annuaire',
      detail: 'Quelle solution privilégier pour l\'authentification locale ?',
      choices: ['Un LDAP open-source auto-hébergé', 'S\'authentifier uniquement via un SSO cloud payant'],
      correct: 0,
      explanation: 'Un annuaire open-source permet maîtrise des données et interopérabilité avec d\'autres services.',
    },
    {
      title: 'Maintenance',
      detail: 'Quel modèle pour maintenir les postes ?',
      choices: ['Atelier interne + documentation partagée', 'Prestataire unique et verrouillé'],
      correct: 0,
      explanation: 'La maintenance collaborative build-up de compétences et évite la dépendance à un seul fournisseur.',
    },
  ],
  [
    {
      title: 'Souveraineté des données',
      detail: 'Quelle pratique protège mieux les données élèves ?',
      choices: ['Héberger chez un opérateur local / commun', 'Confier tout à un grand cloud étranger'],
      correct: 0,
      explanation: 'Un opérateur local est soumis aux mêmes règles et facilite l\'accès et la réversibilité.',
    },
    {
      title: 'Interopérabilité',
      detail: 'Comment favoriser l\'échange entre services pédagogiques ?',
      choices: ['Utiliser des formats ouverts et APIs standards', 'Verrouiller sur un format propriétaire'],
      correct: 0,
      explanation: 'Les standards facilitent l\'interopérabilité et évitent l\'enfermement technologique.',
    },
    {
      title: 'Partage de ressources',
      detail: 'Quelle stratégie pour les ressources pédagogiques ?',
      choices: ['Publier en licence ouverte sur une forge locale', 'Stocker sans licence dans un drive fermé'],
      correct: 0,
      explanation: 'Les licences ouvertes permettent la réutilisation et le partage entre établissements.',
    },
  ],
]

const GAME_INFO = `
<h2>Village NIRD - Le Défi des 3 Portes</h2>
<p>Bienvenue dans le défi NIRD ! Tu vas traverser 3 niveaux avec 3 portes chacun.</p>
<p>Chaque porte contient une question sur les enjeux de souveraineté numérique.</p>
<p><strong>Règles :</strong></p>
<ul>
  <li>Bonne réponse → La porte s'ouvre, tu passes à la suivante</li>
  <li>Mauvaise réponse → Score -1, nouvelle question sur la même porte</li>
  <li>Objectif : Obtenir 9/9 pour remporter le défi !</li>
</ul>
<p style="margin-top: 20px; font-size: 14px; color: #888;">Les réponses sont placées aléatoirement à gauche ou droite.</p>
`

// Babylon bootstrap ------------------------------------------------------

const canvas = document.createElement('canvas')
canvas.id = 'renderCanvas'
document.querySelector<HTMLDivElement>('#app')?.appendChild(canvas)

const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true })
let scene: Scene
let doors: DoorRig[]
let hud: HudRefs
let gameStarted = false

function initGame() {
  const result = createScene(engine, canvas)
  scene = result.scene
  doors = result.doors
  hud = setupHud()
  initializeQuiz(doors, hud, scene)
  gameStarted = true
  hideStartScreen()
}

showStartScreen(initGame)

engine.runRenderLoop(() => {
  if (gameStarted && scene) scene.render()
})
window.addEventListener('resize', () => engine.resize())

// Start screen ---------------------------------------------------------------

function showStartScreen(onStart: () => void) {
  const overlay = document.createElement('div')
  overlay.id = 'start-overlay'
  overlay.style.cssText = `
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background: rgba(1, 2, 5, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    flex-direction: column;
  `

  const content = document.createElement('div')
  content.style.cssText = `
    text-align: center;
    color: white;
    max-width: 600px;
    font-family: Arial, sans-serif;
  `
  content.innerHTML = GAME_INFO

  const startBtn = document.createElement('button')
  startBtn.textContent = 'Démarrer le défi'
  startBtn.style.cssText = `
    margin-top: 30px;
    padding: 12px 40px;
    font-size: 18px;
    background: linear-gradient(135deg, #60388f, #25b0a7);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: transform 0.2s;
  `
  startBtn.onmouseover = () => (startBtn.style.transform = 'scale(1.05)')
  startBtn.onmouseout = () => (startBtn.style.transform = 'scale(1)')
  startBtn.addEventListener('click', () => {
    onStart()
  })

  content.appendChild(startBtn)
  overlay.appendChild(content)
  document.body.appendChild(overlay)
}

function hideStartScreen() {
  const overlay = document.getElementById('start-overlay')
  if (overlay) {
    overlay.remove()
  }
}

function createScene(engine: Engine, canvas: HTMLCanvasElement) {
  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.02, 0.03, 0.08, 1)

  const camera = new ArcRotateCamera('camera', -Math.PI / 2.6, Math.PI / 3, 18, new Vector3(0, 2, 0), scene)
  camera.attachControl(canvas, true)
  camera.panningSensibility = 0
  camera.lowerRadiusLimit = 10
  camera.upperRadiusLimit = 30

  const light = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene)
  light.intensity = 0.95

  const ground = MeshBuilder.CreateGround('ground', { width: 40, height: 40 }, scene)
  const groundMat = new StandardMaterial('groundMat', scene)
  groundMat.diffuseColor = new Color3(0.04, 0.06, 0.12)
  groundMat.specularColor = new Color3(0, 0.2, 0.1)
  ground.material = groundMat

  const walkway = MeshBuilder.CreateBox('walkway', { width: 6, height: 0.2, depth: 30 }, scene)
  walkway.position = new Vector3(0, 0.1, 0)
  const walkwayMat = new StandardMaterial('walkwayMat', scene)
  walkwayMat.diffuseColor = new Color3(0.06, 0.10, 0.16)
  walkwayMat.emissiveColor = new Color3(0.1, 0.8, 0.4)
  walkway.material = walkwayMat

  new GlowLayer('glow', scene).intensity = 0.9

  const positions = [new Vector3(0, 0, -6), new Vector3(0, 0, 0), new Vector3(0, 0, 6)]
  const colors = [new Color3(0.6, 0.38, 1), new Color3(0.25, 0.8, 0.7), new Color3(0.9, 0.6, 0.2)]

  const doors = positions.map((pos, i) =>
    createDoor(scene, {
      id: `door-${i}`,
      position: pos,
      direction: 1,
      color: colors[i],
      index: i,
    }),
  )

  createDataStream(scene)
  createCircuitPattern(scene)

  return { scene, doors, camera }
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
  id: string
  hinge: TransformNode
  panel: Mesh
  leftChoice: Mesh
  rightChoice: Mesh
  mat: StandardMaterial
  direction: number
  baseColor: Color3
  index: number
  leftLabel?: DynamicTexture
  rightLabel?: DynamicTexture
}

// FIX #2: Correct randomization logic
function randomizeAnswers(correct: 0 | 1): AnswerLayout {
  const rand = Math.random() < 0.5
  // Randomly place correct answer on left OR right
  if (rand) {
    return correct === 0
      ? { leftChoice: 0, rightChoice: 1 }
      : { leftChoice: 1, rightChoice: 0 }
  } else {
    return correct === 0
      ? { leftChoice: 1, rightChoice: 0 }
      : { leftChoice: 0, rightChoice: 1 }
  }
}

function initializeQuiz(doors: DoorRig[], hud: HudRefs, scene: Scene) {
  let currentLevel = 0
  const totalLevels = LEVELS.length
  let score = 0
  let locked = false
  let summaryMode = false
  let awaitingDoor: number | null = null
  let solved: boolean[] = new Array(doors.length).fill(false)
  let currentDoorInLevel = 0
  let perDoorQuestionMap: number[] = []
  let perDoorAnswerLayout: AnswerLayout[] = []

  hud.optionLeft.addEventListener('click', () => {
    if (locked || summaryMode) return
    if (awaitingDoor === null) awaitingDoor = currentDoorInLevel
    const layout = perDoorAnswerLayout[awaitingDoor]
    const choiceIndex = layout.leftChoice as 0 | 1
    submitAnswer(awaitingDoor, choiceIndex)
  })
  hud.optionRight.addEventListener('click', () => {
    if (locked || summaryMode) return
    if (awaitingDoor === null) awaitingDoor = currentDoorInLevel
    const layout = perDoorAnswerLayout[awaitingDoor]
    const choiceIndex = layout.rightChoice as 0 | 1
    submitAnswer(awaitingDoor, choiceIndex)
  })

  hud.nextBtn.addEventListener('click', () => {
    if (hud.nextBtn.dataset.mode === 'restart') {
      summaryMode = false
      currentLevel = 0
      score = 0
      loadLevel(currentLevel)
      return
    }

    if (solved.every(Boolean)) {
      if (currentLevel >= totalLevels - 1) {
        showFinalWin()
      } else {
        currentLevel += 1
        loadLevel(currentLevel)
      }
    }
  })

  scene.onPointerObservable.add((pointerInfo) => {
    if (pointerInfo.type !== PointerEventTypes.POINTERUP || locked || summaryMode) return
    const picked = pointerInfo.pickInfo?.pickedMesh
    if (!picked) return

    const doorIdx =
      (picked.metadata?.doorIndex ?? (picked.parent as any)?.metadata?.doorIndex) as number | undefined
    const choiceIdx =
      (picked.metadata?.choiceIndex ?? (picked.parent as any)?.metadata?.choiceIndex) as number | undefined

    if (doorIdx !== undefined && choiceIdx !== undefined) {
      if (doorIdx !== currentDoorInLevel) {
        hud.feedback.textContent = `Tu dois d'abord répondre la porte ${currentDoorInLevel + 1}.`
        return
      }
      submitAnswer(doorIdx, choiceIdx as 0 | 1)
      return
    }

    const panelDoor = extractDoorIndex(picked)
    if (panelDoor === null) return
    if (panelDoor !== currentDoorInLevel) {
      hud.feedback.textContent = `Tu dois d'abord répondre la porte ${currentDoorInLevel + 1}.`
      return
    }
    if (solved[panelDoor]) {
      hud.feedback.textContent = 'Cette porte est déjà résolue.'
      return
    }
    showQuestionForDoor(panelDoor)
  })

  loadLevel(currentLevel)

  function loadLevel(levelIndex: number) {
    currentLevel = levelIndex
    awaitingDoor = null
    locked = false
    summaryMode = false
    solved = new Array(doors.length).fill(false)
    currentDoorInLevel = 0
    perDoorQuestionMap = doors.map((_, i) => i)
    perDoorAnswerLayout = doors.map((_, i) => randomizeAnswers(LEVELS[currentLevel][i].correct))

    hud.summary.hidden = true
    hud.summaryText.textContent = ''
    hud.nextBtn.disabled = true
    hud.nextBtn.dataset.mode = 'level'
    hud.nextBtn.textContent = 'Niveau suivant'
    hud.progress.textContent = `Niveau ${currentLevel + 1} / ${totalLevels}`
    hud.score.textContent = `Score ${score}`
    hud.title.textContent = 'Approche la première porte'
    hud.detail.textContent = 'Réponds à la question sur la porte pour avancer.'
    hud.optionLeft.textContent = 'Option A'
    hud.optionRight.textContent = 'Option B'
    hud.feedback.textContent = 'Clique sur la porte devant toi pour voir la question.'
    hud.feedback.className = 'feedback'
    resetDoors(doors)
    doors.forEach((door, i) => {
      door.mat.emissiveColor = door.baseColor
      const q = LEVELS[currentLevel][perDoorQuestionMap[i]]
      const layout = perDoorAnswerLayout[i]
      if (door.leftLabel) {
        door.leftLabel.drawText(q.choices[layout.leftChoice], null, 130, "bold 22px Arial", "white", "transparent", true)
      }
      if (door.rightLabel) {
        door.rightLabel.drawText(q.choices[layout.rightChoice], null, 130, "bold 22px Arial", "white", "transparent", true)
      }
    })
  }

  function showQuestionForDoor(doorIndex: number) {
    const mappedIndex = perDoorQuestionMap[doorIndex]
    const q = LEVELS[currentLevel][mappedIndex]
    const layout = perDoorAnswerLayout[doorIndex]
    awaitingDoor = doorIndex
    hud.title.textContent = q.title
    hud.detail.textContent = q.detail
    hud.optionLeft.textContent = q.choices[layout.leftChoice]
    hud.optionRight.textContent = q.choices[layout.rightChoice]
    hud.feedback.textContent = 'Choisis une option (HUD ou clique la gauche/droite de la porte).'
    hud.feedback.className = 'feedback'
    const door = doors[doorIndex]
    if (door.leftLabel) door.leftLabel.drawText(q.choices[layout.leftChoice], null, 130, "bold 22px Arial", "white", "transparent", true)
    if (door.rightLabel) door.rightLabel.drawText(q.choices[layout.rightChoice], null, 130, "bold 22px Arial", "white", "transparent", true)
  }

  function submitAnswer(doorIndex: number | null, choiceIndex: 0 | 1) {
    if (doorIndex === null) return
    if (doorIndex !== currentDoorInLevel) {
      hud.feedback.textContent = `Tu dois d'abord répondre la porte ${currentDoorInLevel + 1}.`
      return
    }
    const mappedIndex = perDoorQuestionMap[doorIndex]
    const question = LEVELS[currentLevel][mappedIndex]
    locked = true
    const isCorrect = question.correct === choiceIndex
    if (isCorrect) {
      score += 1
      const door = doors[doorIndex]
      animateDoor(door, Math.PI / 1.6).then(() => {
        solved[doorIndex] = true
        currentDoorInLevel = Math.min(doors.length - 1, currentDoorInLevel + 1)
        
        // FIX #1: Always zoom to next door (even after first door)
        zoomToNextDoor(doors[currentDoorInLevel])
        
        updateAfterCorrect(doorIndex)
        locked = false
        awaitingDoor = null
      })
    } else {
      score = Math.max(0, score - 1)
      const door = doors[doorIndex]
      animateDoor(door, Math.PI / 6).then(() => {
        animateDoor(door, 0, 40).then(() => {
          perDoorQuestionMap[doorIndex] = (perDoorQuestionMap[doorIndex] + 1) % doors.length
          perDoorAnswerLayout[doorIndex] = randomizeAnswers(LEVELS[currentLevel][perDoorQuestionMap[doorIndex]].correct)
          const newQ = LEVELS[currentLevel][perDoorQuestionMap[doorIndex]]
          const newLayout = perDoorAnswerLayout[doorIndex]
          if (door.leftLabel) door.leftLabel.drawText(newQ.choices[newLayout.leftChoice], null, 130, "bold 22px Arial", "white", "transparent", true)
          if (door.rightLabel) door.rightLabel.drawText(newQ.choices[newLayout.rightChoice], null, 130, "bold 22px Arial", "white", "transparent", true)
          awaitingDoor = doorIndex
          hud.title.textContent = newQ.title
          hud.detail.textContent = newQ.detail
          hud.optionLeft.textContent = newQ.choices[newLayout.leftChoice]
          hud.optionRight.textContent = newQ.choices[newLayout.rightChoice]
          hud.feedback.textContent = `Mauvaise réponse. Nouvelle question — réessaie.`
          hud.feedback.className = 'feedback error'
          hud.score.textContent = `Score ${score}`
          locked = false
          awaitingDoor = doorIndex
        })
      })
    }
    hud.score.textContent = `Score ${score}`
  }

  function updateAfterCorrect(doorIndex: number) {
    styleDoorsAfterAnswer(doorIndex, true)
    const mappedIndex = perDoorQuestionMap[doorIndex]
    const q = LEVELS[currentLevel][mappedIndex]
    hud.feedback.textContent = `Bonne réponse ! ${q.explanation}`
    hud.feedback.className = 'feedback success'

    if (solved.every(Boolean)) {
      hud.nextBtn.disabled = false
      if (currentLevel >= totalLevels - 1) {
        hud.nextBtn.textContent = 'Voir le résultat final'
        hud.nextBtn.dataset.mode = 'final'
      } else {
        hud.nextBtn.textContent = 'Passer au niveau suivant'
        hud.nextBtn.dataset.mode = 'levelReady'
      }
      hud.feedback.textContent = `Niveau terminé. Score ${score}`
    } else {
      const next = currentDoorInLevel
      showQuestionForDoor(next)
    }
  }

  function styleDoorsAfterAnswer(selectedIndex: number, correct: boolean) {
    doors.forEach((door, index) => {
      if (solved[index]) {
        door.mat.emissiveColor = new Color3(0.2, 0.95, 0.7)
      } else if (index === selectedIndex && !correct) {
        door.mat.emissiveColor = new Color3(1, 0.35, 0.2)
      } else {
        door.mat.emissiveColor = door.baseColor
      }
    })
  }

  function showFinalWin() {
    summaryMode = true
    hud.summary.hidden = false
    hud.nextBtn.disabled = false
    hud.nextBtn.textContent = 'Rejouer la scène'
    hud.nextBtn.dataset.mode = 'restart'
    const totalQuestions = totalLevels * doors.length
    hud.summaryText.textContent = `Tu obtiens ${score} / ${totalQuestions}. Félicitations — objectif atteint si 100% !`
    hud.feedback.textContent = 'Défi terminé : explore les ressources NIRD pour aller plus loin.'
    hud.feedback.className = 'feedback success'
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

  function zoomToNextDoor(nextDoor: DoorRig) {
    const camera = scene.activeCamera as ArcRotateCamera
    const targetPos = nextDoor.hinge.position.clone()
    targetPos.y += 2
    const newRadius = 11
    const newAlpha = camera.alpha + 0.3

    Animation.CreateAndStartAnimation(
      'camera-zoom',
      camera,
      'target',
      60,
      25,
      camera.target,
      targetPos,
      Animation.ANIMATIONLOOPMODE_CONSTANT,
    )
    Animation.CreateAndStartAnimation(
      'camera-radius',
      camera,
      'radius',
      60,
      25,
      camera.radius,
      newRadius,
      Animation.ANIMATIONLOOPMODE_CONSTANT,
    )
    Animation.CreateAndStartAnimation(
      'camera-alpha',
      camera,
      'alpha',
      60,
      25,
      camera.alpha,
      newAlpha,
      Animation.ANIMATIONLOOPMODE_CONSTANT,
    )
  }
}

// Door helpers -----------------------------------------------------------

function createDoor(
  scene: Scene,
  config: { id: string; position: Vector3; direction: number; color: Color3; index: number },
): DoorRig {
  const hinge = new TransformNode(`${config.id}-hinge`, scene)
  hinge.position = config.position

  const panel = MeshBuilder.CreateBox(`${config.id}-door`, { width: 2, height: 4.2, depth: 0.25 }, scene)
  panel.parent = hinge
  panel.position = new Vector3(0, 2.1, 0)
  const mat = new StandardMaterial(`${config.id}-mat`, scene)
  mat.diffuseColor = new Color3(0.05, 0.08, 0.12)
  mat.emissiveColor = config.color
  mat.specularColor = Color3.Black()
  panel.material = mat
  panel.metadata = { doorIndex: config.index }

  // FIX #3: Larger, more visible choice planes
  const leftChoice = MeshBuilder.CreatePlane(`${config.id}-choice-left`, { width: 1.0, height: 2.0 }, scene)
  leftChoice.parent = hinge
  leftChoice.position = new Vector3(-1.05, 2.2, 0.14)
  leftChoice.isPickable = true
  leftChoice.metadata = { doorIndex: config.index, choiceIndex: 0 }

  const rightChoice = MeshBuilder.CreatePlane(`${config.id}-choice-right`, { width: 1.0, height: 2.0 }, scene)
  rightChoice.parent = hinge
  rightChoice.position = new Vector3(1.05, 2.2, 0.14)
  rightChoice.isPickable = true
  rightChoice.metadata = { doorIndex: config.index, choiceIndex: 1 }

  const leftDt = new DynamicTexture(`${config.id}-leftTxt`, { width: 512, height: 256 }, scene, false)
  const leftLblMat = new StandardMaterial(`${config.id}-leftLblMat`, scene)
  leftLblMat.diffuseTexture = leftDt
  leftLblMat.emissiveColor = config.color.scale(0.8) // Brighter
  leftLblMat.backFaceCulling = false
  leftChoice.material = leftLblMat

  const rightDt = new DynamicTexture(`${config.id}-rightTxt`, { width: 512, height: 256 }, scene, false)
  const rightLblMat = new StandardMaterial(`${config.id}-rightLblMat`, scene)
  rightLblMat.diffuseTexture = rightDt
  rightLblMat.emissiveColor = config.color.scale(0.8) // Brighter
  rightLblMat.backFaceCulling = false
  rightChoice.material = rightLblMat

  const frame = MeshBuilder.CreateBox(`${config.id}-frame`, { width: 2.4, height: 4.6, depth: 0.15 }, scene)
  frame.position = config.position.add(new Vector3(0, 2.3, 0.03))
  const frameMat = new StandardMaterial(`${config.id}-frameMat`, scene)
  frameMat.emissiveColor = config.color.scale(0.25)
  frame.material = frameMat

  leftDt.drawText('A', null, 130, "bold 28px Arial", "white", "transparent", true)
  rightDt.drawText('B', null, 130, "bold 28px Arial", "white", "transparent", true)

  return {
    id: config.id,
    hinge,
    panel,
    leftChoice,
    rightChoice,
    mat,
    direction: config.direction,
    baseColor: config.color,
    index: config.index,
    leftLabel: leftDt,
    rightLabel: rightDt,
  }
}

function resetDoors(doors: DoorRig[]) {
  doors.forEach((door) => {
    door.hinge.rotation.y = 0
  })
}

function extractDoorIndex(mesh: AbstractMesh | null) {
  if (!mesh) return null
  if ((mesh as any).metadata?.doorIndex !== undefined) {
    return ((mesh as any).metadata.doorIndex as number) ?? null
  }
  const parent = mesh.parent as AbstractMesh | null
  if ((parent as any)?.metadata?.doorIndex !== undefined) {
    return ((parent as any).metadata.doorIndex as number) ?? null
  }
  return null
}

// Ambient elements ------------------------------------------------------

function createCircuitPattern(scene: Scene) {
  const circuitLines = [
    [new Vector3(-15, 0.15, -8), new Vector3(15, 0.15, -8)],
    [new Vector3(-15, 0.15, 0), new Vector3(15, 0.15, 0)],
    [new Vector3(-15, 0.15, 8), new Vector3(15, 0.15, 8)],
  ]

  circuitLines.forEach((line, idx) => {
    const tube = MeshBuilder.CreateTube(`circuit-${idx}`, {
      path: line,
      radius: 0.05,
    }, scene)
    const circuitMat = new StandardMaterial(`circuitMat-${idx}`, scene)
    circuitMat.emissiveColor = new Color3(0.1, 0.7, 0.3)
    circuitMat.alpha = 0.6
    tube.material = circuitMat
  })
}

function createDataStream(scene: Scene) {
  const ribbon = MeshBuilder.CreateRibbon(
    'data-stream',
    {
      pathArray: [
        Array.from({ length: 20 }, (_, i) => new Vector3(-10 + i * 1, 1.2 + Math.sin(i * 0.4) * 0.2, -8)),
        Array.from({ length: 20 }, (_, i) => new Vector3(-10 + i * 1, 1.6 + Math.cos(i * 0.3) * 0.2, -8.2)),
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