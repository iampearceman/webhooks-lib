## Getting Started

This is a webhook handler for Clerk events. It is built with Next.js and Novu.

## Setup

1. Clone the repository
2. Run `npm install` to install the dependencies
3. Create a `.env` file and add the following variables:
    - `NOVU_SECRET_KEY`: The secret key for the Novu project
    - `CLERK_SECRET_KEY`: The secret key for the Clerk project
    - `CLERK_WEBHOOK_SECRET`: The webhook secret for the Clerk project
4. Run `npm run dev` to start the development server
5. Run `ngrok http 3000` to start the ngrok server for local testing
6. Copy the https:// URL from ngrok and paste it in the webhook URL field in Clerk

## Testing

1. Ensure you have a Novu project with a workflow created that is corresponding to the Clerk event you want to test
2. Navigate to the Clerk webhook page and create a new webhook
3. Set the webhook URL to the ngrok URL
4. Set the webhook secret to the `CLERK_WEBHOOK_SECRET` in the `.env` file
5. Set the events you want to subscribe to
6. Trigger a Clerk event and see the webhook in Novu

## When going live

1. Navigate to the Emails page under the Customization section in Clerk

Here you can see all the email templates Clerk has available.

2. Click on the email template you want 


The code maps the Clerk events to Novu workflows and sends the events to Novu.


