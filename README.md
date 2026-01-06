# CoinTasker Server

The backend server for the CoinTasker platform, a micro-tasking application where users can earn coins by completing tasks or pay to get tasks done. This server handles authentication, data management, and payment processing.

## 🚀 Features

- **Role-Based Authentication**: Secure endpoints protected by Firebase Authentication with custom roles (Admin, Buyer, Worker).
- **Task Management**: Buyers can create, update, and delete tasks. Workers can browse and submit work.
- **Submission System**: Workers submit proof of work, which Buyers can approve (releasing funds) or reject.
- **Coin System**: Internal currency system for transactions.
  - **Buyers**: Purchase coins via Stripe to pay for tasks.
  - **Workers**: Earn coins and request withdrawals.
- **Payment Integration**: Seamless integration with Stripe for buying coins.
- **Admin Dashboard**: APIs for managing users, withdrawals, and platform statistics.

## 🛠️ Tech Stack

- **Runtime**: [Node.js](https://nodejs.org/)
- **Framework**: [Express.js](https://expressjs.com/)
- **Database**: [MongoDB](https://www.mongodb.com/) (using native driver)
- **Authentication**: [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- **Payments**: [Stripe API](https://stripe.com/docs/api)
- **Deployment**: [Vercel](https://vercel.com/)

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v14 or higher)
- npm or yarn
- A MongoDB Atlas account (or local MongoDB)
- A Firebase project
- A Stripe account

## ⚙️ Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/your-username/cointasker-server.git
    cd cointasker-server
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Environment Configuration**
    Create a `.env` file in the root directory based on the `.env.example` file:
    ```bash
    cp .env.example .env
    ```

    Update the `.env` file with your credentials:
    - `PORT`: Server port (default: 5000)
    - `MONGODB_URI`: Your MongoDB connection string.
    - `STRIPE_SECRET_KEY`: Your Stripe Secret Key.
    - `FB_SERVICE_KEY`: Your Firebase Service Account JSON, **Base64 encoded**.
      > **Tip**: You can get your service account JSON from Firebase Console -> Project Settings -> Service Accounts. Then convert the entire JSON file content to a Base64 string.
    - `SITE_DOMAIN`: The URL of your frontend application (e.g., `http://localhost:5173` for local development) used for Stripe redirect URLs.

## 🚀 Running the Server

**Development Mode** (with nodemon for auto-restarts):
```bash
npm run dev
```

The server will start at `http://localhost:5000` (or your defined PORT).

**Production Match**:
The `index.js` is the main entry point.

## 🔗 API Endpoints

### Authentication & Users
- `GET /users`: Get all users (Admin only).
- `GET /users/:email`: Get user details.
- `POST /users`: Create a new user.
- `PATCH /users/role/:id`: Update user role (Admin only).
- `DELETE /users/:id`: Delete a user (Admin only).

### Tasks
- `POST /tasks`: Create a new task (Buyer only).
- `GET /tasks`: Get tasks (optionally filter by buyer email).
- `GET /tasks/available`: Get tasks that need workers.
- `GET /tasks/:id`: Get task details.
- `PATCH /tasks/:id`: Update a task (Buyer only).
- `DELETE /tasks/:id`: Delete a task.

### Submissions
- `POST /submissions`: Submit work for a task (Worker only).
- `GET /submissions/my`: Get submissions for a worker.
- `GET /submissions/buyer-pending`: Get pending submissions for a buyer's tasks.
- `PATCH /submissions/approve/:id`: Approve a submission (Buyer only).
- `PATCH /submissions/reject/:id`: Reject a submission (Buyer only).

### Payments & Withdrawals
- `POST /create-checkout-session`: Initialize Stripe payment.
- `PATCH /payment-success`: Webhook/Callback for successful payment.
- `POST /withdrawals`: Request a withdrawal (Worker only).
- `GET /withdrawals`: Get withdrawal requests.
- `PATCH /withdrawals/:id`: Update withdrawal status (Admin only).

### Stats
- `GET /admin-stats`: System-wide statistics.
- `GET /buyer/stats`: Buyer-specific stats.
- `GET /worker/stats`: Worker-specific stats.

## ☁️ Deployment

This project is configured for easy deployment on **Vercel**.
The `vercel.json` file handles the configuration.

1.  Install Vercel CLI: `npm i -g vercel`
2.  Run `vercel`
3.  Set the environment variables in the Vercel dashboard.

---
Built for CoinTasker Platform.
