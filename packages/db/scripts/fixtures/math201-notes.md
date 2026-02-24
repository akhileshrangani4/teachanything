# Linear Algebra - MATH201

## Chapter 1: Vectors

A **vector** is a mathematical object that has both magnitude and direction. In linear algebra, vectors are typically represented as ordered lists of numbers.

A vector in R^n is an ordered n-tuple of real numbers:

> **v** = (v1, v2, ..., vn)

### Vector Operations

| Operation    | Formula                              | Example               |
| ------------ | ------------------------------------ | --------------------- |
| Addition     | (a1, a2) + (b1, b2) = (a1+b1, a2+b2) | (1,2) + (3,4) = (4,6) |
| Scalar mult. | c * (a1, a2) = (c*a1, c\*a2)         | 3 \* (1,2) = (3,6)    |
| Dot product  | (a1, a2) . (b1, b2) = a1*b1 + a2*b2  | (1,2) . (3,4) = 11    |

### Properties of Vector Addition

- **Commutative**: u + v = v + u
- **Associative**: (u + v) + w = u + (v + w)
- **Identity element**: u + 0 = u
- **Inverse element**: u + (-u) = 0

---

## Chapter 2: Matrices

A **matrix** is a rectangular array of numbers arranged in rows and columns. An m x n matrix has m rows and n columns.

### Matrix Operations

1. **Addition**: Add corresponding elements (matrices must have same dimensions)
2. **Scalar multiplication**: Multiply every element by a scalar
3. **Matrix multiplication**: The product AB is defined when columns of A = rows of B

### Important Matrix Types

- **Identity matrix (I)**: Square matrix with 1s on the diagonal, 0s elsewhere
- **Zero matrix**: All elements are zero
- **Diagonal matrix**: Non-zero elements only on the main diagonal
- **Symmetric matrix**: A = A^T
- **Orthogonal matrix**: A^T \* A = I

---

## Chapter 3: Systems of Linear Equations

A system of linear equations can be represented in matrix form as **Ax = b**.

### Solution Methods

1. **Gaussian Elimination**: Transform to row echelon form
2. **Gauss-Jordan Elimination**: Transform to reduced row echelon form
3. **Matrix Inverse**: If A is invertible, x = A^(-1) \* b
4. **Cramer's Rule**: Uses determinants (small systems only)

### Types of Solutions

- **Exactly one solution**: consistent, independent
- **Infinitely many solutions**: consistent, dependent
- **No solution**: inconsistent

---

## Chapter 4: Eigenvalues and Eigenvectors

An **eigenvector** of a square matrix A is a non-zero vector v such that:

> Av = lambda \* v

where lambda is the **eigenvalue** corresponding to v.

### Finding Eigenvalues

1. Solve det(A - lambda \* I) = 0 (the characteristic equation)
2. The roots are the eigenvalues

### Applications

- Principal Component Analysis (PCA) in data science
- Google's PageRank algorithm
- Stability analysis of dynamical systems
- Quantum mechanics
- Vibration analysis in engineering

---

## Chapter 5: Linear Transformations

A **linear transformation** T: V -> W preserves addition and scalar multiplication:

- T(u + v) = T(u) + T(v)
- T(cv) = cT(v)

### Key Concepts

| Concept             | Definition                    |
| ------------------- | ----------------------------- |
| Kernel (null space) | Set of vectors mapped to zero |
| Image (range)       | Set of all possible outputs   |
| Rank                | Dimension of the image        |
| Nullity             | Dimension of the kernel       |

> **Rank-Nullity Theorem**: rank(T) + nullity(T) = dim(V)
