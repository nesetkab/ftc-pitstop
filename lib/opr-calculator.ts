/**
 * OPR (Offensive Power Rating) Calculator
 * Based on The Blue Alliance's mathematical approach
 * https://blog.thebluealliance.com/2017/10/05/the-math-behind-opr-an-introduction/
 */

interface Match {
  matchNumber: number
  red1: number
  red2: number
  blue1: number
  blue2: number
  redScore: number
  blueScore: number
  redFoul: number
  blueFoul: number
  redAuto?: number
  blueAuto?: number
  redEndgame?: number
  blueEndgame?: number
  played: boolean
}

interface TeamOPR {
  teamNumber: number
  opr: number
  dpr: number
  autoOpr: number
  teleopOpr: number
  endgameOpr: number
  matchesPlayed: number
}

export class OPRCalculator {
  private teams: Set<number> = new Set()
  private matches: Match[] = []

  constructor(matches: Match[]) {
    this.matches = matches.filter((m) => m.played && m.redScore !== null && m.blueScore !== null)
      .map(m => ({
        ...m,
        redFoul: m.redFoul ?? 0,
        blueFoul: m.blueFoul ?? 0
      }))

    // Collect all unique team numbers
    this.matches.forEach((match) => {
      this.teams.add(match.red1)
      this.teams.add(match.red2)
      this.teams.add(match.blue1)
      this.teams.add(match.blue2)
    })
  }

  /**
   * Calculate OPR using matrix algebra
   * Solves the equation: A * x = b
   * Where A is the team participation matrix, x is OPR vector, b is score vector
   */
  calculateOPR(): TeamOPR[] {
    const teamList = Array.from(this.teams).sort((a, b) => a - b)
    const numTeams = teamList.length
    const numMatches = this.matches.length

    if (numMatches === 0 || numTeams === 0) {
      return []
    }

    // Create team index mapping
    const teamToIndex = new Map<number, number>()
    teamList.forEach((team, index) => {
      teamToIndex.set(team, index)
    })

    // Build the coefficient matrix A (team participation matrix)
    // Each row represents an alliance in a match
    // Each column represents a team
    const A: number[][] = []
    const scores: number[] = []

    this.matches.forEach((match) => {
      // Red alliance row
      const redRow = new Array(numTeams).fill(0)
      redRow[teamToIndex.get(match.red1)!] = 1
      redRow[teamToIndex.get(match.red2)!] = 1
      A.push(redRow)
      // Non-penalty score = final score - opponent's foul points (removes penalty points added to our score)
      scores.push(match.redScore - match.blueFoul)

      // Blue alliance row
      const blueRow = new Array(numTeams).fill(0)
      blueRow[teamToIndex.get(match.blue1)!] = 1
      blueRow[teamToIndex.get(match.blue2)!] = 1
      A.push(blueRow)
      // Non-penalty score = final score - opponent's foul points (removes penalty points added to our score)
      scores.push(match.blueScore - match.redFoul)
    })

    // Solve using least squares: (A^T * A) * x = A^T * b
    const AtA = this.multiplyMatrices(this.transpose(A), A)
    const Atb = this.multiplyMatrixVector(this.transpose(A), scores)

    // Solve the system using Gaussian elimination
    const oprValues = this.solveLinearSystem(AtA, Atb)

    // Calculate DPR (Defensive Power Rating)
    const dprValues = this.calculateDPR(teamList, teamToIndex)

    // Calculate Auto OPR
    const autoOprValues = this.calculateAutoOPR(teamList, teamToIndex)

    // Calculate TeleOp OPR (Teleop only, without endgame)
    const teleopOprValues = this.calculateTeleopOPR(teamList, teamToIndex)

    // Calculate Endgame OPR
    const endgameOprValues = this.calculateEndgameOPR(teamList, teamToIndex)

    // Count matches played for each team
    const matchCounts = this.countMatchesPlayed(teamList, teamToIndex)

    // Build result array
    return teamList.map((teamNumber, index) => ({
      teamNumber,
      opr: oprValues[index] || 0,
      dpr: dprValues[index] || 0,
      autoOpr: autoOprValues[index] || 0,
      teleopOpr: teleopOprValues[index] || 0,
      endgameOpr: endgameOprValues[index] || 0,
      matchesPlayed: matchCounts[index] || 0,
    }))
  }

  /**
   * Calculate DPR (Defensive Power Rating)
   * DPR represents how many points a team prevents the opposing alliance from scoring
   */
  private calculateDPR(teamList: number[], teamToIndex: Map<number, number>): number[] {
    const numTeams = teamList.length
    const A: number[][] = []
    const opponentScores: number[] = []

    this.matches.forEach((match) => {
      // For red alliance, opponent score is blue score (non-penalty)
      const redRow = new Array(numTeams).fill(0)
      redRow[teamToIndex.get(match.red1)!] = 1
      redRow[teamToIndex.get(match.red2)!] = 1
      A.push(redRow)
      // Non-penalty opponent score = opponent's final score - our foul points (removes penalty points we gave them)
      opponentScores.push(match.blueScore - match.redFoul)

      // For blue alliance, opponent score is red score (non-penalty)
      const blueRow = new Array(numTeams).fill(0)
      blueRow[teamToIndex.get(match.blue1)!] = 1
      blueRow[teamToIndex.get(match.blue2)!] = 1
      A.push(blueRow)
      // Non-penalty opponent score = opponent's final score - our foul points (removes penalty points we gave them)
      opponentScores.push(match.redScore - match.blueFoul)
    })

    // Solve for DPR
    const AtA = this.multiplyMatrices(this.transpose(A), A)
    const Atb = this.multiplyMatrixVector(this.transpose(A), opponentScores)

    return this.solveLinearSystem(AtA, Atb)
  }

  /**
   * Calculate Auto OPR
   * OPR specifically for the autonomous period
   */
  private calculateAutoOPR(teamList: number[], teamToIndex: Map<number, number>): number[] {
    const numTeams = teamList.length
    const A: number[][] = []
    const autoScores: number[] = []

    this.matches.forEach((match) => {
      // Only calculate if auto scores are available
      if (match.redAuto !== undefined && match.blueAuto !== undefined) {
        // Red alliance row
        const redRow = new Array(numTeams).fill(0)
        redRow[teamToIndex.get(match.red1)!] = 1
        redRow[teamToIndex.get(match.red2)!] = 1
        A.push(redRow)
        autoScores.push(match.redAuto)

        // Blue alliance row
        const blueRow = new Array(numTeams).fill(0)
        blueRow[teamToIndex.get(match.blue1)!] = 1
        blueRow[teamToIndex.get(match.blue2)!] = 1
        A.push(blueRow)
        autoScores.push(match.blueAuto)
      }
    })

    // If no auto data available, return zeros
    if (A.length === 0) {
      return new Array(numTeams).fill(0)
    }

    // Solve for Auto OPR
    const AtA = this.multiplyMatrices(this.transpose(A), A)
    const Atb = this.multiplyMatrixVector(this.transpose(A), autoScores)

    return this.solveLinearSystem(AtA, Atb)
  }

  /**
   * Calculate TeleOp OPR (Teleop including endgame)
   * This is the OPR for the teleop period (total - auto - fouls)
   */
  private calculateTeleopOPR(teamList: number[], teamToIndex: Map<number, number>): number[] {
    const numTeams = teamList.length
    const A: number[][] = []
    const teleopScores: number[] = []

    this.matches.forEach((match) => {
      // Only calculate if auto scores are available
      if (match.redAuto !== undefined && match.blueAuto !== undefined) {
        // Red alliance row
        const redRow = new Array(numTeams).fill(0)
        redRow[teamToIndex.get(match.red1)!] = 1
        redRow[teamToIndex.get(match.red2)!] = 1
        A.push(redRow)
        // TeleOp score = final score - auto score - opponent fouls (includes endgame)
        teleopScores.push(match.redScore - match.redAuto - match.blueFoul)

        // Blue alliance row
        const blueRow = new Array(numTeams).fill(0)
        blueRow[teamToIndex.get(match.blue1)!] = 1
        blueRow[teamToIndex.get(match.blue2)!] = 1
        A.push(blueRow)
        // TeleOp score = final score - auto score - opponent fouls (includes endgame)
        teleopScores.push(match.blueScore - match.blueAuto - match.redFoul)
      }
    })

    // If no teleop data available, return zeros
    if (A.length === 0) {
      return new Array(numTeams).fill(0)
    }

    // Solve for TeleOp OPR
    const AtA = this.multiplyMatrices(this.transpose(A), A)
    const Atb = this.multiplyMatrixVector(this.transpose(A), teleopScores)

    return this.solveLinearSystem(AtA, Atb)
  }

  /**
   * Calculate Endgame OPR
   * OPR specifically for the endgame period
   */
  private calculateEndgameOPR(teamList: number[], teamToIndex: Map<number, number>): number[] {
    const numTeams = teamList.length
    const A: number[][] = []
    const endgameScores: number[] = []

    this.matches.forEach((match) => {
      // Only calculate if endgame scores are available
      if (match.redEndgame !== undefined && match.blueEndgame !== undefined) {
        // Red alliance row
        const redRow = new Array(numTeams).fill(0)
        redRow[teamToIndex.get(match.red1)!] = 1
        redRow[teamToIndex.get(match.red2)!] = 1
        A.push(redRow)
        endgameScores.push(match.redEndgame)

        // Blue alliance row
        const blueRow = new Array(numTeams).fill(0)
        blueRow[teamToIndex.get(match.blue1)!] = 1
        blueRow[teamToIndex.get(match.blue2)!] = 1
        A.push(blueRow)
        endgameScores.push(match.blueEndgame)
      }
    })

    // If no endgame data available, return zeros
    if (A.length === 0) {
      return new Array(numTeams).fill(0)
    }

    // Solve for Endgame OPR
    const AtA = this.multiplyMatrices(this.transpose(A), A)
    const Atb = this.multiplyMatrixVector(this.transpose(A), endgameScores)

    return this.solveLinearSystem(AtA, Atb)
  }

  /**
   * Count matches played for each team
   */
  private countMatchesPlayed(teamList: number[], teamToIndex: Map<number, number>): number[] {
    const counts = new Array(teamList.length).fill(0)

    this.matches.forEach((match) => {
      counts[teamToIndex.get(match.red1)!]++
      counts[teamToIndex.get(match.red2)!]++
      counts[teamToIndex.get(match.blue1)!]++
      counts[teamToIndex.get(match.blue2)!]++
    })

    return counts
  }

  /**
   * Matrix transpose
   */
  private transpose(matrix: number[][]): number[][] {
    if (matrix.length === 0) return []
    const rows = matrix.length
    const cols = matrix[0].length
    const result: number[][] = []

    for (let j = 0; j < cols; j++) {
      result[j] = []
      for (let i = 0; i < rows; i++) {
        result[j][i] = matrix[i][j]
      }
    }

    return result
  }

  /**
   * Matrix multiplication
   */
  private multiplyMatrices(a: number[][], b: number[][]): number[][] {
    const aRows = a.length
    const aCols = a[0].length
    const bCols = b[0].length
    const result: number[][] = []

    for (let i = 0; i < aRows; i++) {
      result[i] = []
      for (let j = 0; j < bCols; j++) {
        let sum = 0
        for (let k = 0; k < aCols; k++) {
          sum += a[i][k] * b[k][j]
        }
        result[i][j] = sum
      }
    }

    return result
  }

  /**
   * Matrix-vector multiplication
   */
  private multiplyMatrixVector(matrix: number[][], vector: number[]): number[] {
    const result: number[] = []

    for (let i = 0; i < matrix.length; i++) {
      let sum = 0
      for (let j = 0; j < vector.length; j++) {
        sum += matrix[i][j] * vector[j]
      }
      result[i] = sum
    }

    return result
  }

  /**
   * Solve linear system Ax = b using Gaussian elimination with partial pivoting
   */
  private solveLinearSystem(A: number[][], b: number[]): number[] {
    const n = A.length
    const augmented: number[][] = []

    // Create augmented matrix [A|b]
    for (let i = 0; i < n; i++) {
      augmented[i] = [...A[i], b[i]]
    }

    // Forward elimination with partial pivoting
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k
        }
      }

      // Swap rows
      if (maxRow !== i) {
        ;[augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]]
      }

      // Make all rows below this one 0 in current column
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[i][i]) < 1e-10) continue // Skip if pivot is too small

        const factor = augmented[k][i] / augmented[i][i]
        for (let j = i; j <= n; j++) {
          augmented[k][j] -= factor * augmented[i][j]
        }
      }
    }

    // Back substitution
    const x: number[] = new Array(n).fill(0)
    for (let i = n - 1; i >= 0; i--) {
      x[i] = augmented[i][n]
      for (let j = i + 1; j < n; j++) {
        x[i] -= augmented[i][j] * x[j]
      }
      if (Math.abs(augmented[i][i]) > 1e-10) {
        x[i] /= augmented[i][i]
      }
    }

    return x
  }
}

/**
 * Utility function to calculate OPR for a set of matches
 */
export function calculateOPRForMatches(matches: Match[]): TeamOPR[] {
  const calculator = new OPRCalculator(matches)
  return calculator.calculateOPR()
}

/**
 * Get OPR data for a specific team
 */
export function getTeamOPR(teamNumber: number, oprData: TeamOPR[]): TeamOPR | null {
  return oprData.find((team) => team.teamNumber === teamNumber) || null
}

/**
 * Sort teams by OPR (highest first)
 */
export function sortTeamsByOPR(oprData: TeamOPR[]): TeamOPR[] {
  return [...oprData].sort((a, b) => b.opr - a.opr)
}

/**
 * Sort teams by DPR (lowest first, since lower DPR is better)
 */
export function sortTeamsByDPR(oprData: TeamOPR[]): TeamOPR[] {
  return [...oprData].sort((a, b) => a.dpr - b.dpr)
}
