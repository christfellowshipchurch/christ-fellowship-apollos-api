# Infrastructure Landscaping with Terraform

## Why?

As the complexity of our project grows, it will be beneficial to keep track of the infrastructure requirements of the app in a format that can be updated, shared, and executed upon in the same was as the code itself is updated, shared, and executed upon.

Infrastructure as Code, or IoC for short, is a strategy for keeping "plans" on how to create infrastructure in the cloud. In our setup, we are using Terraform as the language and tool of choice.

Terraform helps us answer the following questions:

* What resources do I need for my app to function?
* How do I add a CND?
* If the core apollos project adds infrastructure requirements, how do I bring those to my project?

Terraform **does not** answer the following questions?

* How do I deploy my code?
* How does my code run in the cloud?

Use the phrase, "terraform is a tool to sculp the landscape for my application" to guide your expectations for Terraform. (Thanks @Lepozepo)

## How?

In our repo, we have a terraform file present to handle the infrastructure setup for Heroku. To get started, run:

```
brew install terraform # install terraform if you don't have it yet
terraform init # installs the heroku plugin
```

Now that you have terraform running, and the heroku plugin installed, you're ready to deploy. At this point, copy and paste the `example.terraform.tfvalues` as `terraform.tfvalues`, and replace the values in that file with your own values. If you don't do this, you will be required to enter your email and api key every time you deploy.

You can now run
```
terraform apply
```
to deploy your infrastructure to Heroku. Once you have deployed your infrastructure, however you have a few steps left to take.

1. Fill in your Config Variables in the Heroku Dashboard.
  - Click on the project, then on the settings tab, then "Reveal Config Vars"
2. Setup Deployment.
  - You can either deploy the app via attaching the project to your github account, or deploying from the command line. Click the
  "Deploy" tab in Heroku for further instructions.


## Future...

### AWS Config
