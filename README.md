# Sample AWS SAM + Swagger
The readme contains notes for future reference and anyone who can find themselves stuck while doing something similar.

It's a small hello world type project created while exploring AWS SAM + Swagger. The idea behind this sample to control 
everything using YAML files, altogether avoiding switching to AWS console.

To make things a bit more challenging & interesting:
* Used both proxy and non-proxy integration.
* API Gateway mapping templates to map the query string to lambda input.
* CORS with allowed origin  '*'.
* Multiple deployment stages: Dev, Test, Prod.
* Custom domain name for API for every stage.
* Use AWS SSM Parameter Store for data you don't want to expose in config files.

# Why Swagger?
The bare SAM doesn't support API Gateway mapping templates, but Swagger does. As a bonus, it generates fancy 
documentation that even can execute sample requests to endpoints. Well, documentation is a must for a big project, 
but it can help with personal ones too: you'll thank yourself if you revisit this project after years.

[Here's the documentation for this project API.](https://natsew.github.io/samhello/)

# CORS for non-proxy integrations
API Gateway should handle headers itself when you use a non-proxy integration.  
To achieve this, add the 'Cors' section in the SAM template.
```yaml
Resources:
  RestAPI:
    ...
    Properties:
      ...
      Cors:
        AllowMethods: "'GET,OPTIONS,POST'"
        AllowHeaders: "'Content-Type'"
        AllowOrigin: "'*'"
```
Every method inside the Swagger file should have the headers section described under responses.
```yaml
paths:
  /fun:
    get:
      ...
      responses:
        200:
          description: OK
          headers:
            Access-Control-Allow-Headers:
              type: string
            Access-Control-Allow-Methods:
              type: string
            Access-Control-Allow-Origin:
              type: string
```
The 'responseParameters' should describe header mappings for the 'x-amazon-apigateway-integration' property 
inside the Swagger file. Setting only 'Access-Control-Allow-Origin' is enough for this project, 
but here you also can set both 'Access-Control-Allow-Headers' and 'Access-Control-Allow-Methods' if required.

```yaml
 x-amazon-apigateway-integration:
        ...
        responses:
          default:
            statusCode: "200"
            responseParameters:
              method.response.header.Access-Control-Allow-Origin: "'*'"
```
**You should add headers to both sections as described above.**
* If you add it to Swagger responses only, CORS won't work.
* If you add it to 'x-amazon-apigateway-integration' responses only, the deployment will fail.

# CORS for Lambda proxy integrations
As with non-proxy integrations, add the 'Cors' section under API declaration in the SAM template.
```yaml
Resources:
  RestAPI:
    ...
    Properties:
      ...
      Cors:
        AllowMethods: "'GET,OPTIONS,POST'"
        AllowHeaders: "'Content-Type'"
        AllowOrigin: "'*'"
```
No need to add headers into the Swagger file, but functions must return them now. 
My Swagger file has headers for proxy functions under the Swagger response sections for consistency & documentation, 
but it's not required for proxy integrations to work with CORS.
```javascript
exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({
      message: "Hello World!",
    }),
  };
};
```

# API Gateway mapping templates
It might be hard to change the request format without breaking all existing code that depends on your APIs. 
Here comes the mapping ability that allows you to transform requests to the format your function expects.

Say you had a GET function that accepts a list of numbers from the query parameters. 
It parses query string, extracts request data from it, etc. 
Now you need to use the same function internally or convert it to POST request. Your choices are:
* Create two functions with the same business logic but different inputs.
* Modify the existing function to check all possible inputs, like query, post body, just event body.
* Use API Gateway mapping template to transform requests to the one unified format across your project. 
  API Gateway uses Apache Velocity Template Language (VTL in short) for mappings.

My example function expects an array of numbers as the event object's property, 
but API should provide the GET method with a list of numbers in the query. 
Below is the template that takes numbers from a query and maps it to the 'numbers' property.
```
{
    "numbers" : [
        #if("$!input.params('numbers')" != "")
            #foreach($num in $input.params('numbers').split(','))
                "$num"
                #if($foreach.hasNext),#end
            #end
        #end
    ]
}
```
Now the Lambda can access it directly, avoiding parsing the query parameters.
```
const realData = event.numbers;
realData >>> [1,2,3...]
```

# Multiple deployment stages
Under parameters section declare the 'Stage' and 'NamePrefix' variables.
Treat 'NamePrefix' as a constant.
```yaml
Parameters:
  Stage:
    Type: String
    Default: Dev
    AllowedValues:
      - Dev
      - Test
      - Prod
    Description: Enviroment to deploy, possible values [Dev, Test, Prod]

  NamePrefix:
    Type: String
    Default: SamHelloWorld
```
The magic happens in the resource names.
```yaml
Resources:
  RestAPI:
    Type: AWS::Serverless::Api
    Properties:
      Name: !Sub "${NamePrefix}_${Stage}_REST_API"
      ...

  HelloWorldFunction:
    Type: AWS::Serverless::Function # More info about Function Resource: https://github.com/awslabs/serverless-application-model/blob/master/versions/2016-10-31.md#awsserverlessfunction
    Properties:
      FunctionName: !Sub "${NamePrefix}_${Stage}_hello"
      ...
```
At the deployment, AWS replaces ${VARIABLE_NAME} with actual values, for example:
```yaml
"${NamePrefix}_${Stage}_hello" ---> "SamHelloWorld_Dev_hello"
```
**You must create different deployment configurations for SAM. Using dynamic names only is not enough.**
Otherwise, AWS CloudFormation won't deploy a separate stack but rename resources in the existing one.

Run the guided deployment for every possible deployment stage:
* Specify different stack names in the process. Like samhello-dev and samhello-prod.
* Set override for the 'Stage' parameter to match the stack type. If it's samhello-dev, then Stage=Dev.
* DON'T override the 'NamePrefix' parameter.
* Save configuration all configuration in one SAM configuration file. By default it's samconfig.toml.
* Name SAM configuration environment after the stage variable. If it's configuration to deploy samhello-prod, name it prod.
* It might be convenient to set dev as the default stage, so 'sam deploy' will automatically deploy to dev.

Things like the git branch in naming need a separate deployment config - something like samhello-dev-newthing1.
```
>sam deploy --guided

Configuring SAM deploy
======================

        Looking for config file [samconfig.toml] :  Found
        Reading default arguments  :  Success

        Setting default arguments for 'sam deploy'
        =========================================
        Stack Name [samhello]: samhello-prod
        AWS Region [us-east-2]:
        Parameter Stage [Dev]: Prod
        Parameter StackName [SamHelloWorld]:
        #Shows you resources changes to be deployed and require a 'Y' to initiate deploy
        Confirm changes before deploy [Y/n]: y
        #SAM needs permission to be able to create roles to connect to the resources in your template
        Allow SAM CLI IAM role creation [Y/n]: y
        HelloWorldFunction may not have authorization defined, Is this okay? [y/N]: y
        AnotherFunction may not have authorization defined, Is this okay? [y/N]: y
        ReStringFunction may not have authorization defined, Is this okay? [y/N]: y
        PostItFunction may not have authorization defined, Is this okay? [y/N]: y
        Save arguments to configuration file [Y/n]: y
        SAM configuration file [samconfig.toml]:
        SAM configuration environment [default]: prod
```
When you want to deploy to prod run:
```
sam deploy --config-env prod
```
Bonus: make Lambdas aware of the current stage by passing it as an environment variable.
```yaml
HelloWorldFunction:
    Type: AWS::Serverless::Function 
    Properties:
      ...
      Environment:
        Variables:
          currentStage: !Sub ${Stage}
```
Now you can access it inside the code, NodeJS example:
```javascript
const message = `Hello World from ${process.env.currentStage} stage!`;
```

# API Gateway custom domain name
While it's possible to do with SAM, you need an ARN of SSL certificate on AWS Certificate Manager
before writing any YAML code. After you have it, add the 'Domain' section under the SAM template's API declaration.
```yaml
Resources:
  RestAPI:
    ...
    Properties:
     ...
      Domain:
        DomainName: samhello.hidden.bid
        CertificateArn: arn:*******
```

Deploy it once to see the native API Gateway domain name in the web console. The last thing you need to make it work 
is to create an ALIAS record for your domain pointing to this API gateway domain.

If your domain is hosted in Route 53 on the same account as SAM application, you can create certificates in the
template using AWS::CertificateManager::Certificate from CloudFormation, then reference it instead.
AWS::Route53::RecordSet can automate DNS pointing too. While it all sounds nice, I have domain managed by a different provider,
and find the above approach much simpler.

# Custom domain names for different stages
Above setup works nicely until you consider to have multiple environments like dev, test, prod, etc: 
a domain can be associated only with one API Gateway resource. My solution for this is to have different domains:
* samhello-dev.hidden.bid for dev
* samhello-test.hidden.bid for test
* samhello.hidden.bid for prod
In the SAM template, the best place to declare this is the Mappings section.
Make sure your names inside the Domain mapping equal to possible Stage parameter values.
```yaml
Mappings:
  Domain:
    Dev:
      Name: samhello-dev.hidden.bid
    Test:
      Name: samhello-test.hidden.bid
    Prod:
      Name: samhello.hidden.bid
```
Then do the following change for the 'Domain' property of API Resource.
The !FindInMap function finds map inside 'Domain' mapping with the same name as the runtime value of 'Stage' parameter,
then takes value associated to key 'Name'.
```yaml
Resources:
  RestAPI:
    Type: AWS::Serverless::Api
    Properties:
      ...
      Domain:
        DomainName: !FindInMap [Domain, !Ref Stage, Name]
        CertificateArn: arn:*******
```
The certificate must either cover all possible domains for this application or be a wildcard certificate like *.hidden.bid.
Don't forget to point DNS to the API gateway's domain for all stages.

# Hide certificate ARN using AWS SSM Parameter Store
The same goes for any other data you want to keep private, like database connection links, passwords, etc.
After you have created the parameter inside the parameter store console, add reference to it in the
SAM template. Set the 'Default' value to the exact name of the created parameter in the SSM Parameter Store.
```yaml
Parameters:
  ...
  DomainCertificateArn:
    Type: AWS::SSM::Parameter::Value<String>
    Default: /Certificates/hidden.bid/subomains
```
You can access the value of this parameter anywhere in the template.
```yaml
  CertificateArn: !Ref DomainCertificateArn
```