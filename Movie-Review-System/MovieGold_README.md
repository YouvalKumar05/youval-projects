# 🎬 Movie Gold

> A Full-Stack Scalable Movie Browsing & Review Platform built using React, Spring Boot, MongoDB Atlas, and Maven.

---

# 📋 Table of Contents

1. Problem Statement
2. Objectives
3. Solution Overview
4. System Architecture
5. Technology Stack
6. Backend Architecture
7. Frontend Architecture
8. Database Design
9. Data Structures Used
10. Request Flow Diagrams
11. API Documentation
12. Scalability Considerations
13. Performance Analysis
14. Security Considerations
15. Project Structure
16. Future Enhancements
17. Key Learnings

---

# 🎯 Problem Statement

Modern movie platforms must support:

- Large movie catalogs
- Thousands of reviews per movie
- Fast movie retrieval
- Scalable database design
- Clean separation of concerns

A naive MongoDB implementation embeds reviews directly inside movie documents.

```text
Movie
 ├── Review
 ├── Review
 ├── Review
 ├── Review
 └── Review
```

As reviews grow:

- Document size increases continuously
- MongoDB 16MB document limit can be reached
- Update operations become expensive
- Concurrent writes become difficult

---

# 💡 Solution Overview

Movie Gold solves this problem using MongoDB Document References.

```text
Traditional Design

Movie
 ├── Review
 ├── Review
 ├── Review
 └── Review


Movie Gold Design

Movies Collection
       │
       ▼
Review References
       │
       ▼
Reviews Collection
```

Benefits:

- Unlimited reviews
- Smaller documents
- Faster updates
- Better scalability
- Easier maintenance

---

# 🏗️ System Architecture

```text
+------------------------------------------------+
|                React Frontend                  |
+------------------------+-----------------------+
                         |
                         | Axios HTTP Requests
                         ▼
+------------------------------------------------+
|             Spring Boot Controllers            |
+------------------------+-----------------------+
                         |
                         ▼
+------------------------------------------------+
|               Service Layer                    |
|          Business Logic Processing             |
+------------------------+-----------------------+
                         |
                         ▼
+------------------------------------------------+
|             Repository Layer                   |
|      Spring Data MongoDB Repositories          |
+------------------------+-----------------------+
                         |
                         ▼
+------------------------------------------------+
|                MongoDB Atlas                   |
+------------------------------------------------+
```

---

# ⚙️ N-Tier Architecture

```text
Presentation Layer
│
├── React
├── Components
├── Axios
└── UI Rendering

Business Layer
│
├── MovieService
├── ReviewService
└── Business Rules

Data Access Layer
│
├── MovieRepository
├── ReviewRepository
└── MongoDB Queries

Database Layer
│
├── Movies Collection
└── Reviews Collection
```

---

# 🛠️ Technology Stack

| Technology | Purpose | Why Used |
|------------|----------|----------|
| Java 21 | Backend Development | Modern Java Features |
| Spring Boot | REST APIs | Rapid Development |
| MongoDB Atlas | Database | Flexible NoSQL Storage |
| Spring Data MongoDB | Data Access | Repository Pattern |
| React | Frontend UI | Component-Based Architecture |
| Axios | API Calls | Easy HTTP Communication |


---

# 🔥 Backend Architecture

## Controller Layer

Responsibilities:

- Receive Requests
- Validate Inputs
- Return Responses

Classes:

```text
MovieController
ReviewController
```

---

## Service Layer

Responsibilities:

- Business Logic
- Workflow Processing
- Data Transformation

Classes:

```text
MovieService
ReviewService
```

---

## Repository Layer

Responsibilities:

- Database Access
- CRUD Operations
- Query Execution

Classes:

```text
MovieRepository
ReviewRepository
```

---

## Model Layer

Classes:

```text
Movie
Review
```

Represents MongoDB Documents.

---

# 🎨 Frontend Architecture

Components:

```text
App
│
├── Hero
├── Movie Carousel
├── Movie Card
├── Trailer Button
└── Review Form
```

Responsibilities:

- Display Movies
- Display Reviews
- Submit Reviews
- Consume REST APIs

---

# 🗄️ Database Design

## ER Diagram

```text
┌─────────────────────────┐
│        MOVIES           │
├─────────────────────────┤
│ _id                     │
│ imdbId                  │
│ title                   │
│ releaseDate             │
│ genres                  │
│ reviewIds[]             │
└─────────────┬───────────┘
              │
              │ 1 : MANY
              ▼
┌─────────────────────────┐
│        REVIEWS          │
├─────────────────────────┤
│ _id                     │
│ body                    │
└─────────────────────────┘
```

---

## Movie Document

```json
{
  "_id": "123",
  "imdbId": "tt1375666",
  "title": "Inception",
  "genres": ["Action","Sci-Fi"],
  "reviewIds": ["r1","r2"]
}
```

---

## Review Document

```json
{
  "_id": "r1",
  "body": "Amazing movie!"
}
```

---

# 📚 Data Structures Used

## ArrayList

Used For:

```java
List<String> genres;
List<String> backdrops;
```

Why:

- Dynamic Size
- Fast Traversal

---

## List<Review>

Used For:

```java
List<Review> reviewIds;
```

Why:

- One Movie → Many Reviews

---

## Optional

Used For:

```java
Optional<Movie>
```

Why:

- Prevent NullPointerException

---

# 🔄 Request Flow Diagrams

## Fetch Movies

```text
User
 │
 ▼
React UI
 │
 ▼
Axios GET Request
 │
 ▼
MovieController
 │
 ▼
MovieService
 │
 ▼
MovieRepository
 │
 ▼
MongoDB Atlas
 │
 ▼
Response Returned
 │
 ▼
React UI Updated
```

---

## Submit Review

```text
User
 │
 ▼
Review Form
 │
 ▼
Axios POST Request
 │
 ▼
ReviewController
 │
 ▼
ReviewService
 │
 ▼
ReviewRepository
 │
 ▼
MongoDB
 │
 ▼
Review Created
 │
 ▼
Movie Updated
 │
 ▼
Response Returned
```

---

# 🔌 API Documentation

## GET All Movies

```http
GET /api/v1/movies
```

Response:

```json
[
  {
    "title":"Inception"
  }
]
```

---

## GET Movie By IMDb ID

```http
GET /api/v1/movies/{imdbId}
```

---

## POST Review

```http
POST /api/v1/reviews
```

Request:

```json
{
  "reviewBody":"Amazing Movie!",
  "imdbId":"tt1375666"
}
```

---

# 🚀 Scalability Considerations

## Problem

Embedded Reviews:

```text
Movie
 ├── Review
 ├── Review
 ├── Review
 └── Review
```

Problems:

- Large Documents
- Expensive Updates
- MongoDB 16MB Limit

---

## Solution

Document References

```text
Movie
 │
 └── reviewIds[]
          │
          ▼
      Reviews Collection
```

Benefits:

- Unlimited Reviews
- Constant Document Size
- Faster Updates
- Better Concurrency

---

# 📊 Performance Analysis

| Operation | Complexity |
|------------|------------|
| Get Movie By ID | O(1) Indexed Lookup |
| Create Review | O(1) |
| Get All Movies | O(N) |

---

# 🔒 Security Considerations

Current:

- MongoDB Authentication
- Environment Variables

Future:

- JWT Authentication
- Spring Security
- Input Validation
- Rate Limiting

---

# 📁 Project Structure

```text
movies/
│
├── controller/
│   ├── MovieController.java
│   └── ReviewController.java
│
├── service/
│   ├── MovieService.java
│   └── ReviewService.java
│
├── repository/
│   ├── MovieRepository.java
│   └── ReviewRepository.java
│
├── model/
│   ├── Movie.java
│   └── Review.java
│
├── resources/
│   ├── application.properties
│   └── .env
│
├── pom.xml
├── mvnw
└── README.md
```

---

# 🔮 Future Enhancements

- JWT Authentication
- User Accounts
- Ratings System
- Pagination
- Search Functionality
- Docker Deployment
- CI/CD Pipeline
- Redis Caching
- AWS Deployment

---

# 📖 Key Learnings

This project helped strengthen understanding of:

- Spring Boot
- REST APIs
- MongoDB Data Modeling
- Repository Pattern
- Layered Architecture
- Full Stack Development
- Frontend-Backend Integration
- Scalable System Design

---

# 👨‍💻 Interview Talking Points

1. Why MongoDB instead of SQL?
2. Why Document References instead of Embedding?
3. How does Spring Boot Dependency Injection work?
4. Why use Repository Pattern?
5. How does React communicate with Spring Boot?
6. How can this system scale to millions of reviews?
7. How would JWT Authentication be integrated?
8. How would pagination improve performance?
9. How would caching improve response times?
10. What architectural improvements would be needed for production?
