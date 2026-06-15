# Movie Gold 🎬

A **full-stack, scalable movie browsing and review platform** built with React, Java Spring Boot, and MongoDB. Designed with clean architecture principles and optimized for horizontal scalability.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Database Design](#database-design)
5. [Project Structure](#project-structure)
6. [API Endpoints](#api-endpoints)
7. [Setup Instructions](#setup-instructions)
8. [Key Features](#key-features)
9. [Design Decisions](#design-decisions)
10. [Performance Characteristics](#performance-characteristics)
11. [Code Snippets Explained](#code-snippets-explained)
12. [Known Limitations & Future Improvements](#known-limitations--future-improvements)

---

## 🎯 Overview

Movie Gold is a demonstration of **scalable system design** principles applied to a real-world application. Instead of embedding reviews within movie documents (which would hit MongoDB's 16MB size limit), the platform uses **document references** to maintain separate collections for movies and reviews.

### Problem Solved

```
Traditional Approach (❌)          Movie Gold Approach (✅)
┌─────────────────────┐            ┌─────────────┐      ┌──────────────┐
│ Movie Document      │            │ Movie Coll. │      │ Review Coll. │
├─────────────────────┤            ├─────────────┤      ├──────────────┤
│ title: "Inception"  │            │ title       │      │ body: "..."  │
│ reviews: [          │            │ reviewIds→┐ │      │ body: "..."  │
│  {body: "Great!"},  │            │            │ │      │ body: "..."  │
│  {body: "Amazing"}, │            │            └─┼─────>│ ...          │
│  ...× 100,000       │            │            │ │      │ (unlimited)  │
│ ]                   │            └─────────────┘      └──────────────┘
│ (16MB LIMIT HIT) ❌ │
└─────────────────────┘
```

---

## 🛠️ Tech Stack

### Backend
- **Java 21** - Modern JVM language (used in [pom.xml](file:///Users/youvalkumar/Documents/movies/pom.xml#L30))
- **Spring Boot 4.1.0** - Application framework (configured in [pom.xml](file:///Users/youvalkumar/Documents/movies/pom.xml#L5-L10))
- **Spring Data MongoDB** - Database abstraction (declared in [pom.xml](file:///Users/youvalkumar/Documents/movies/pom.xml#L33-L36))
- **MongoDB** - NoSQL database
- **Lombok** - Reduces boilerplate code (declared in [pom.xml](file:///Users/youvalkumar/Documents/movies/pom.xml#L49-L52))
- **Maven** - Build management

### Frontend
- **React** - UI framework (configured in [package.json](file:///Users/youvalkumar/Documents/MovieClient/movie-gold-v1/package.json))
- **Axios** - HTTP client (configured in [axiosConfig.js](file:///Users/youvalkumar/Documents/MovieClient/movie-gold-v1/src/api/axiosConfig.js))
- **CSS/Responsive Design** - Styling (seen in [App.css](file:///Users/youvalkumar/Documents/MovieClient/movie-gold-v1/src/App.css))

### DevOps & Config
- **.env Files** - Environment configuration (configured in [.env](file:///Users/youvalkumar/Documents/movies/.env))
- **CORS** - Cross-origin resource sharing configured via `@CrossOrigin` annotations.

---

## 🏗️ Architecture

### N-Tier Layered Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                       │
│                  (React SPA - Browser)                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Components | State Management | HTTP Client (Axios) │  │
│  │ [App.js](file:///Users/youvalkumar/Documents/MovieClient/movie-gold-v1/src/App.js)                                              │  │
│  └────────────────────────┬─────────────────────────────┘  │
└─────────────────────────────┼──────────────────────────────┘
                              │ REST API
┌─────────────────────────────▼──────────────────────────────┐
│                  CONTROLLER LAYER                           │
│           (Request Handling & HTTP Routing)                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ [MovieController](file:///Users/youvalkumar/Documents/movies/src/main/java/com/youval/movies/MovieController.java)   │   [ReviewController](file:///Users/youvalkumar/Documents/movies/src/main/java/com/youval/movies/ReviewController.java)  │  │
│  │ @GetMapping          │      @PostMapping             │  │
│  │ @PathVariable        │      @RequestBody             │  │
│  └────────────────────────────────┬─────────────────────┘  │
└─────────────────────────────────────┼──────────────────────┘
                                      │ Business Logic
┌─────────────────────────────────────▼──────────────────────┐
│                  SERVICE LAYER                              │
│          (Business Logic & Data Transformation)             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ [MovieService](file:///Users/youvalkumar/Documents/movies/src/main/java/com/youval/movies/MovieService.java)       │   [ReviewService](file:///Users/youvalkumar/Documents/movies/src/main/java/com/youval/movies/ReviewService.java)      │  │
│  │ - allMovies()        │      - createReview()         │  │
│  │ - singleMovie()      │      - Atomic operations      │  │
│  └────────────────────────────────┬─────────────────────┘  │
└─────────────────────────────────────┼──────────────────────┘
                                      │ Data Access
┌─────────────────────────────────────▼──────────────────────┐
│                  REPOSITORY LAYER                           │
│     (Database Abstraction - Spring Data MongoDB)            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ [MovieRepository](file:///Users/youvalkumar/Documents/movies/src/main/java/com/youval/movies/MovieRepository.java)   │   [ReviewRepository](file:///Users/youvalkumar/Documents/movies/src/main/java/com/youval/movies/ReviewRepository.java)  │  │
│  │ extends MongoRepo    │      extends MongoRepo        │  │
│  │ - findAll()          │      - insert()               │  │
│  │ - findMovieByImdbId()│      - Custom queries         │  │
│  └────────────────────────────────┬─────────────────────┘  │
└─────────────────────────────────────┼──────────────────────┘
                                      │ Queries
┌─────────────────────────────────────▼──────────────────────┐
│                  DATABASE LAYER                             │
│              (MongoDB - Data Persistence)                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Collections: movies │ reviews                │  │
│  │    Indexes │ Replication │ Sharding                  │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### System Workflows (White-Background Diagrams)

#### 1. Use Case Diagram
Describes how a user interacts with the platform:
![Use Case Diagram](file:///Users/youvalkumar/Documents/movies/docs/images/use_case_diagram.png)

#### 2. Workflow Diagram
Describes how components process requests step-by-step:
![System Workflow Diagram](file:///Users/youvalkumar/Documents/movies/docs/images/workflow_diagram.png)

#### 3. Request Flow Diagram (Chronological Timeline)

```
USER ACTION                 FRONTEND              BACKEND                DATABASE
    │                          │                    │                       │
    │ Click "Load Movies"      │                    │                       │
    ├─────────────────────────>│                    │                       │
    │                          │ GET /api/v1/movies │                       │
    │                          ├───────────────────>│                       │
    │                          │                    │ Call MovieService    │
    │                          │                    ├────────────────────>│
    │                          │                    │                  Query
    │                          │                    │                MongoDB
    │                          │                    │<────────────────────┤
    │                          │<───────────────────┤ Return List<Movie>  │
    │                          │ JSON with Reviews  │                       │
    │<─────────────────────────┤ (Resolved via     │                       │
    │ Display Carousel         │  @DocumentRef)    │                       │
    │                          │                    │                       │
    │ Submit Review Form       │                    │                       │
    ├─────────────────────────>│                    │                       │
    │                          │ POST /api/v1/reviews
    │                          │ {reviewBody, imdbId}
    │                          ├───────────────────>│                       │
    │                          │                    │ Create Review        │
    │                          │                    ├────────────────────>│
    │                          │                    │                  INSERT
    │                          │                    │<────────────────────┤
    │                          │                    │ Return Review._id    │
    │                          │                    │                       │
    │                          │                    │ Update Movie         │
    │                          │                    ├────────────────────>│
    │                          │                    │         PUSH review_id
    │                          │                    │<────────────────────┤
    │                          │<───────────────────┤ 201 Created          │
    │<─────────────────────────┤ + Review JSON      │                       │
    │ Append Review to UI      │                    │                       │
```

---

## 🗄️ Database Design

### Entity Relationship Diagram (ERD)

```
┌─────────────────────────────────────┐
│        MOVIES COLLECTION            │
├─────────────────────────────────────┤
│ _id          : ObjectId (PK)        │
│ imdbId       : String (Indexed)     │◄─────────┐
│ title        : String               │          │
│ releaseDate  : String               │          │
│ trailerLink  : String               │          │
│ poster       : String               │          │
│ genres       : Array<String>        │          │
│ backdrops    : Array<String>        │          │
│ reviewIds    : Array<ObjectId>      ├─────────┐│
└─────────────────────────────────────┘         ││
                                                 ││
                        1─to─Many (Reference)    ││
                                                 ││
                                        ┌────────┴┴─────────────────────┐
                                        │    REVIEWS COLLECTION          │
                                        ├────────────────────────────────┤
                                        │ _id        : ObjectId (PK)     │
                                        │ body       : String            │
                                        └────────────────────────────────┘
```

### Document Examples

**Movie Document:**
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439011"),
  "imdbId": "tt1375666",
  "title": "Inception",
  "releaseDate": "2010-07-16",
  "trailerLink": "https://www.youtube.com/watch?v=...",
  "poster": "https://image.tmdb.org/t/p/...",
  "genres": ["Action", "Sci-Fi", "Thriller"],
  "backdrops": ["https://...", "https://..."],
  "reviewIds": [
    ObjectId("507f1f77bcf86cd799439012"),
    ObjectId("507f1f77bcf86cd799439013")
  ]
}
```

**Review Document:**
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439012"),
  "body": "An absolute masterpiece! The cinematography and storytelling are phenomenal."
}
```

### Why Document References?

| Aspect | Embedding | Document References (Movie Gold) |
| :--- | :--- | :--- |
| **Document Size** | Grows with each review | Stays constant |
| **Query Speed** | Slows down for large documents | Consistently fast |
| **Update Performance** | $O(N)$ based on document size | $O(1)$ database push |
| **Max Reviews** | Limit hit at ~100k (16MB BSON cap) | Unlimited reviews |
| **Concurrent Writes** | High locking conflicts | Low locking overhead |

---

## 📁 Project Structure

```
movies/
├── src/
│   ├── main/
│   │   ├── java/com/youval/movies/
│   │   │   ├── [MoviesApplication.java](file:///Users/youvalkumar/Documents/movies/src/main/java/com/youval/movies/MoviesApplication.java)          # Spring Boot entry point
│   │   │   ├── [MovieController.java](file:///Users/youvalkumar/Documents/movies/src/main/java/com/youval/movies/MovieController.java)            # Movie HTTP endpoints
│   │   │   ├── [MovieService.java](file:///Users/youvalkumar/Documents/movies/src/main/java/com/youval/movies/MovieService.java)               # Movie business logic
│   │   │   ├── [MovieRepository.java](file:///Users/youvalkumar/Documents/movies/src/main/java/com/youval/movies/MovieRepository.java)            # Movie data access
│   │   │   ├── [Movie.java](file:///Users/youvalkumar/Documents/movies/src/main/java/com/youval/movies/Movie.java)                      # Movie entity
│   │   │   ├── [ReviewController.java](file:///Users/youvalkumar/Documents/movies/src/main/java/com/youval/movies/ReviewController.java)           # Review HTTP endpoints
│   │   │   ├── [ReviewService.java](file:///Users/youvalkumar/Documents/movies/src/main/java/com/youval/movies/ReviewService.java)              # Review business logic
│   │   │   ├── [ReviewRepository.java](file:///Users/youvalkumar/Documents/movies/src/main/java/com/youval/movies/ReviewRepository.java)           # Review data access
│   │   │   └── [Review.java](file:///Users/youvalkumar/Documents/movies/src/main/java/com/youval/movies/Review.java)                     # Review entity
│   │   └── resources/
│   │       ├── application.properties          # Spring configuration
│   │       └── .env                            # Environment variables
│   └── test/
│       └── java/com/youval/movies/
│           └── MoviesApplicationTests.java     # Test suite
├── docs/
│   └── images/
│       ├── use_case_diagram.png                # Use Case Diagram
│       └── workflow_diagram.png                # Workflow Diagram
├── pom.xml                                     # Maven dependencies
├── mvnw / mvnw.cmd                             # Maven wrapper scripts
└── README.md                                   # This file
```

---

## 🔌 API Endpoints

### Movies Endpoints

**GET `/api/v1/movies`**
- Retrieve all movies with their resolved reviews.
- Response: `List<Movie>`
- Status: `200 OK`

```bash
curl http://localhost:8080/api/v1/movies
```

**GET `/api/v1/movies/{imdbId}`**
- Retrieve a single movie by IMDB ID.
- Response: `Optional<Movie>`
- Status: `200 OK` or `404 Not Found`

```bash
curl http://localhost:8080/api/v1/movies/tt1375666
```

### Reviews Endpoints

**POST `/api/v1/reviews`**
- Create a new review and link it to a movie.
- Request Body:
  ```json
  {
    "reviewBody": "Amazing film!",
    "imdbId": "tt1375666"
  }
  ```
- Response: `Review` (with auto-generated ObjectId)
- Status: `201 Created`

```bash
curl -X POST http://localhost:8080/api/v1/reviews \
  -H "Content-Type: application/json" \
  -d '{"reviewBody":"Great movie!","imdbId":"tt1375666"}'
```

---

## 🚀 Setup Instructions

### Prerequisites
- Java 21+
- Maven 3.6+
- MongoDB 5.0+ (local or Atlas)
- Node.js (for React frontend)

### Backend Setup

**1. Configure Environment Variables**
Configure the environment variables in [.env](file:///Users/youvalkumar/Documents/movies/.env):
```env
MONGO_DATABASE=movies-db
MONGO_USER=your_username
MONGO_PASSWORD=your_password
MONGO_CLUSTER=your-cluster.mongodb.net
```

**2. Build Project**
```bash
./mvnw clean package
```

**3. Run Application**
```bash
./mvnw spring-boot:run
```

Server starts on `http://localhost:8080`

---

## ✨ Key Features

1.  **Scalable Architecture:** Document referencing prevents MongoDB size limits.
2.  **Clean Code:** Follows the N-Tier layered architecture pattern.
3.  **Spring Data Abstraction:** Out-of-the-box Mongo CRUD repositories.
4.  **Targeted Atomic Updates:** Employs [MongoTemplate](file:///Users/youvalkumar/Documents/movies/src/main/java/com/youval/movies/ReviewService.java#L16) to update array references atomically without loading large documents into memory.

---

## 🎯 Design Decisions

### Decision 1: Document References vs Embedding
**Chosen: Document References.**
*Rationale:* Prevents the 16MB document size limit, keeps queries fast, and handles concurrent review writes with minimal locking.

### Decision 2: Atomic Updates via MongoTemplate
We use `MongoTemplate` inside [ReviewService.java](file:///Users/youvalkumar/Documents/movies/src/main/java/com/youval/movies/ReviewService.java#L22-L25):
```java
mongoTemplate.update(Movie.class)
    .matching(Criteria.where("imdbId").is(imdbId))
    .apply(new Update().push("reviewIds").value(review))
    .first();
```
*Rationale:* Appends the review reference directly in MongoDB. This removes race conditions (dirty writes) and skips the slow "fetch-modify-save" flow.

---

## 📊 Performance Characteristics

### Time Complexity

| Operation | Complexity | Notes |
| :--- | :--- | :--- |
| **GET all movies** | $O(N)$ | Where $N$ is the number of movies. |
| **GET movie by imdbId** | $O(\log N)$ or $O(1)$ | Speeds up via B-Tree index lookup. |
| **Create review** | $O(1)$ | Saves review and appends reference to array. |

---

## 🔍 Code Snippets Explained

### Entity with Document Reference ([Movie.java](file:///Users/youvalkumar/Documents/movies/src/main/java/com/youval/movies/Movie.java))

```java
@Document(collection = "movies")
@Data
@AllArgsConstructor
@NoArgsConstructor
public class Movie {
    @Id
    private ObjectId id;
    private String imdbId;
    private String title;
    
    @DocumentReference
    private List<Review> reviewIds;
}
```
*   `@DocumentReference` tells Spring Boot not to embed the reviews array inside the movie document, but instead store a list of ObjectIds that reference the reviews collection. On query execution, Spring resolves these references automatically.

---

## 🚨 Known Limitations & Future Improvements

1.  ❌ **No Input Validation:** Need to add `@Valid` and constraints for XSS/security.
2.  ❌ **No Authentication:** Standard APIs are open. Needs Spring Security + JWT.
3.  ❌ **Pagination:** The movie retrieval fetches all records at once. Needs `Pageable` in repositories to limit memory usage.
