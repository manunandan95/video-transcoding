# video-transcoding

This is a [lambda](https://aws.amazon.com/lambda/) that will convert S3 objects with a `.mov` extension to `.webm`
files. It downloads the `.mov` file, performs the conversion with `ffmpeg`, then reuploads the `.webm` file in destination bucket.

## Setup

Clone the repository, then run the following:

```bash
$ npm install
```

In `.env`, replace the value of `AWS_ROLE_ARN` with the value you create below in ["Create a role"](#create-a-role).
Replace other config values as necessary,

### Create a role

First create an IAM policy that has full `Get` and `Put` access to your S3 bucket, then in the
[IAM roles console](https://console.aws.amazon.com/iam/home#/roles), create a new role. When you're prompted to
choose a role type, select "AWS Lambda." When you're prompted to attach policies, attach the one you just created and
the one named "CloudWatchLogsFullAccess."

Once you've finished creating the role, copy the ARN and put it in `.env` as mentioned above.

## Compile
```bash
$ npm run compile
```

## Deploy

To deploy the lambda to AWS, run:

```bash
$ node-lambda deploy -e production

```

### Subscribe to S3 uploads

In the AWS lambda console, add a trigger for your function. Specify the bucket you want to monitor, the event type as
"Object Created (All)", and the suffix as ".mov". 

