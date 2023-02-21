# XLER8R Patterns

XLER8R Patterns are designed to fast track most commonly used architectures, while XLER8R Lite supports provisioning 
for static web hosting infrastructure only, XLER8R premium provides support for building serverless APIs, container based 
applications, organizational hierarchy setup, sso setup, management account and member account setup and many more. 
Reach out to info@cre8ivelogix.com to find out more about premium version of XLER8R https://xler8r.com

## Create a CDK project
To try out XLER8R Lite by itself you can create a new CDK project by running the following commands

```shell
cdk init app --language typescript
```

This will create a bare bone CDK project.

## Adding WA-CDK Lite dependency
Open CDK project in your favorite IDE, goto package.json file and add the WA-CDK-Lite dependency

```json
{
   "dependencies": {
      "@cre8ivelogix/xler8r-lite": "CURRENT_VERSION"
   }
}
```

## Install Dependencies
Once package.json file is updated, you can install the dependencies by running the following commands

```shell
npm install
```

## Using Well Architected CDK constructs
Now that you have all the constructs available from XLER8R Lite,
use them just like any other class in typescript.

For example in the following code snippet we are using WaBucket from AWS-CDK-Lite package

```ts
 new X8Website(this, "TestWebSite", {
    waDomainName: 'example.com',
});
```

The Bucket created using WaBucket by default satisfies various security and compliance requirements,
checkout WaBucket class documentation for details.

### Well Architected CDK Version Updates

The version of all CDK packages are fixed to the same version. If an
upgrade is desired, please make sure that all CDK packages are upgraded
to the same version at the same time. Different versions of CDK mixed
in the project may cause type incompatibilities.

### Useful commands

-  `npm run build` compile typescript to js
-  `npm run watch` watch for changes and compile
-  `npm run test` perform the jest unit tests
-  `npm run build-test` builds and runs unit tests
-  `npm run doc-gen` generate documentation
-  `npm run pretty` runs prettier on source code

