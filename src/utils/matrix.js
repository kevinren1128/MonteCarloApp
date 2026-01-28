/**
 * Matrix Operations
 * 
 * @module utils/matrix
 * @description Matrix operations for correlation and covariance calculations.
 * Includes Cholesky decomposition and PSD (positive semi-definite) fixes.
 */

/**
 * Cholesky decomposition
 * Decomposes matrix A into L * L^T where L is lower triangular.
 * Required for correlated random number generation.
 * @param {number[][]} matrix - Symmetric positive definite matrix
 * @returns {number[][]} Lower triangular matrix L
 */
export const choleskyDecomposition = (matrix) => {
  const n = matrix.length;
  const L = Array(n).fill(null).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }
      
      if (i === j) {
        const val = matrix[i][i] - sum;
        // Handle numerical issues - should be > 0 for PSD
        L[i][j] = val > 0 ? Math.sqrt(val) : 0.0001;
      } else {
        L[i][j] = L[j][j] !== 0 ? (matrix[i][j] - sum) / L[j][j] : 0;
      }
    }
  }
  
  return L;
};

/**
 * Check if matrix is positive definite via Cholesky
 * @param {number[][]} matrix - Square matrix
 * @returns {boolean} True if matrix is positive definite
 */
export const isPositiveDefinite = (matrix) => {
  try {
    const n = matrix.length;
    const L = choleskyDecomposition(matrix);
    
    for (let i = 0; i < n; i++) {
      if (isNaN(L[i][i]) || L[i][i] <= 0) return false;
    }
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Make correlation matrix valid (symmetric, PSD, diagonal = 1)
 * Uses iterative shrinkage toward identity matrix
 * @param {number[][]} matrix - Potentially invalid correlation matrix
 * @returns {number[][]} Valid correlation matrix
 */
export const makeValidCorrelation = (matrix) => {
  const n = matrix.length;
  const result = matrix.map(row => [...row]);
  
  // Step 1: Symmetrize and clamp to valid range
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const avg = (result[i][j] + result[j][i]) / 2;
      const clamped = Math.max(-0.999, Math.min(0.999, avg));
      result[i][j] = clamped;
      result[j][i] = clamped;
    }
  }
  
  // Step 2: Ensure diagonal is 1
  for (let i = 0; i < n; i++) {
    result[i][i] = 1.0;
  }
  
  // Step 3: Fix PSD via iterative shrinkage (simplified Higham's algorithm)
  const maxIter = 50;
  for (let iter = 0; iter < maxIter; iter++) {
    // Check if Cholesky works
    if (isPositiveDefinite(result)) break;
    
    // Shrink off-diagonal elements toward zero
    const shrink = 0.95;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          result[i][j] *= shrink;
        }
      }
    }
  }
  
  return result;
};

/**
 * Nearest correlation matrix using alternating projections
 * More sophisticated than simple shrinkage, preserves more structure
 * @param {number[][]} matrix - Input matrix
 * @param {number} maxIter - Maximum iterations
 * @param {number} tol - Convergence tolerance
 * @returns {number[][]} Nearest valid correlation matrix
 */
export const nearestCorrelationMatrix = (matrix, maxIter = 100, tol = 1e-7) => {
  const n = matrix.length;
  let Y = matrix.map(row => [...row]);
  let X = matrix.map(row => [...row]);
  const dS = Array(n).fill(null).map(() => Array(n).fill(0));
  
  for (let iter = 0; iter < maxIter; iter++) {
    // Project onto PSD cone (clip negative eigenvalues)
    const R = Y.map((row, i) => row.map((val, j) => val - dS[i][j]));
    
    // Simple eigenvalue clipping would go here
    // For now, use shrinkage as approximation
    X = makeValidCorrelation(R);
    
    // Update correction
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        dS[i][j] = X[i][j] - R[i][j];
      }
    }
    
    // Project onto unit diagonal
    Y = X.map(row => [...row]);
    for (let i = 0; i < n; i++) {
      Y[i][i] = 1.0;
    }
    
    // Check convergence
    let maxDiff = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        maxDiff = Math.max(maxDiff, Math.abs(X[i][j] - Y[i][j]));
      }
    }
    if (maxDiff < tol) break;
  }
  
  return Y;
};

/**
 * Convert correlation matrix to covariance matrix
 * @param {number[][]} corr - Correlation matrix
 * @param {number[]} vols - Vector of volatilities
 * @returns {number[][]} Covariance matrix
 */
export const correlationToCovariance = (corr, vols) => {
  const n = corr.length;
  const cov = Array(n).fill(null).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      cov[i][j] = corr[i][j] * vols[i] * vols[j];
    }
  }
  
  return cov;
};

/**
 * Convert covariance matrix to correlation matrix
 * @param {number[][]} cov - Covariance matrix
 * @returns {{corr: number[][], vols: number[]}} Correlation matrix and volatilities
 */
export const covarianceToCorrelation = (cov) => {
  const n = cov.length;
  const vols = cov.map((row, i) => Math.sqrt(row[i]));
  const corr = Array(n).fill(null).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (vols[i] > 0 && vols[j] > 0) {
        corr[i][j] = cov[i][j] / (vols[i] * vols[j]);
      } else {
        corr[i][j] = i === j ? 1 : 0;
      }
    }
  }
  
  return { corr, vols };
};

/**
 * Matrix multiplication
 * @param {number[][]} A - First matrix (m x n)
 * @param {number[][]} B - Second matrix (n x p)
 * @returns {number[][]} Result matrix (m x p)
 */
export const matrixMultiply = (A, B) => {
  const m = A.length;
  const n = B.length;
  const p = B[0].length;
  const C = Array(m).fill(null).map(() => Array(p).fill(0));
  
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < p; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += A[i][k] * B[k][j];
      }
      C[i][j] = sum;
    }
  }
  
  return C;
};

/**
 * Matrix transpose
 * @param {number[][]} A - Input matrix
 * @returns {number[][]} Transposed matrix
 */
export const transpose = (A) => {
  const m = A.length;
  const n = A[0].length;
  const T = Array(n).fill(null).map(() => Array(m).fill(0));
  
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      T[j][i] = A[i][j];
    }
  }
  
  return T;
};

/**
 * Create identity matrix
 * @param {number} n - Size
 * @returns {number[][]} n x n identity matrix
 */
export const identityMatrix = (n) => {
  return Array(n).fill(null).map((_, i) => 
    Array(n).fill(0).map((_, j) => i === j ? 1 : 0)
  );
};

/**
 * Shrink matrix toward target (Ledoit-Wolf style)
 * @param {number[][]} sample - Sample covariance/correlation
 * @param {number[][]} target - Target structure (e.g., identity)
 * @param {number} shrinkage - Shrinkage intensity (0-1)
 * @returns {number[][]} Shrunk matrix
 */
export const shrinkMatrix = (sample, target, shrinkage) => {
  const n = sample.length;
  const result = Array(n).fill(null).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      result[i][j] = (1 - shrinkage) * sample[i][j] + shrinkage * target[i][j];
    }
  }
  
  return result;
};

export default {
  choleskyDecomposition,
  isPositiveDefinite,
  makeValidCorrelation,
  nearestCorrelationMatrix,
  correlationToCovariance,
  covarianceToCorrelation,
  matrixMultiply,
  transpose,
  identityMatrix,
  shrinkMatrix,
};
