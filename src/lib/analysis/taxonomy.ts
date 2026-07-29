/**
 * Skill taxonomy.
 *
 * Each canonical skill carries its aliases so that "k8s", "Kubernetes" and
 * "kube" all resolve to one concept. Without this, keyword matching produces
 * false gaps — the single biggest source of bad advice in resume tooling.
 */

export type SkillCategory =
  | "language"
  | "framework"
  | "database"
  | "cloud"
  | "devops"
  | "observability"
  | "architecture"
  | "ai"
  | "testing"
  | "practice"
  | "security"
  | "data"
  | "mobile"
  | "soft";

export interface Skill {
  /** Display form, used in the UI. */
  canonical: string;
  category: SkillCategory;
  aliases: readonly string[];
  /**
   * Relative importance when the term appears in a posting. Concrete
   * technologies outrank generic practices.
   */
  weight: number;
}

const s = (
  canonical: string,
  category: SkillCategory,
  aliases: readonly string[] = [],
  weight = 1,
): Skill => ({
  canonical,
  category,
  aliases: aliases.filter((a) => a.toLowerCase() !== canonical.toLowerCase()),
  weight,
});

export const SKILLS: readonly Skill[] = [
  // --- Languages ----------------------------------------------------------
  s("Python", "language", ["python3", "py"], 1.2),
  s("Java", "language", ["java8", "java 11", "java 17", "java 21"], 1.2),
  s("JavaScript", "language", ["js", "ecmascript", "es6"], 1.2),
  s("TypeScript", "language", ["ts"], 1.2),
  s("Go", "language", ["golang"], 1.2),
  s("C++", "language", ["cpp", "c plus plus"], 1.2),
  s("C#", "language", ["csharp", "c sharp", ".net"], 1.2),
  s("C", "language", [], 1.1),
  s("Rust", "language", [], 1.2),
  s("Ruby", "language", [], 1.1),
  s("PHP", "language", [], 1.0),
  s("Scala", "language", [], 1.1),
  s("Kotlin", "language", [], 1.1),
  s("Swift", "language", [], 1.1),
  s("R", "language", [], 1.0),
  s("MATLAB", "language", [], 0.9),
  s("SQL", "language", [], 1.2),
  s("Bash", "language", ["shell", "shell scripting", "zsh"], 0.9),
  s("PowerShell", "language", [], 0.9),
  s("Perl", "language", [], 0.7),
  s("Elixir", "language", [], 0.9),
  s("Haskell", "language", [], 0.8),
  s("Dart", "language", [], 0.9),

  // --- Frontend -----------------------------------------------------------
  s("React", "framework", ["react.js", "reactjs"], 1.3),
  s("Next.js", "framework", ["nextjs", "next js"], 1.2),
  s("Angular", "framework", ["angularjs"], 1.1),
  s("Vue", "framework", ["vue.js", "vuejs"], 1.1),
  s("Svelte", "framework", ["sveltekit"], 1.0),
  s("Redux", "framework", ["redux toolkit"], 1.0),
  s("Tailwind CSS", "framework", ["tailwind", "tailwindcss"], 1.0),
  s("HTML", "framework", ["html5"], 0.7),
  s("CSS", "framework", ["css3", "scss", "sass"], 0.7),
  s("Webpack", "framework", ["vite", "rollup", "esbuild"], 0.8),
  s("React Native", "mobile", ["react-native"], 1.1),
  s("Flutter", "mobile", [], 1.1),
  s("iOS", "mobile", ["swiftui", "uikit"], 1.1),
  s("Android", "mobile", ["jetpack compose"], 1.1),

  // --- Backend ------------------------------------------------------------
  s("Node.js", "framework", ["node", "nodejs"], 1.2),
  s("Express", "framework", ["express.js", "expressjs"], 1.0),
  s("Django", "framework", [], 1.1),
  s("Flask", "framework", [], 1.1),
  s("FastAPI", "framework", ["fast api"], 1.2),
  s("Spring Boot", "framework", ["spring", "springboot"], 1.2),
  s("Ruby on Rails", "framework", ["rails"], 1.0),
  s("Laravel", "framework", [], 0.9),
  s("ASP.NET", "framework", ["asp.net core", "dotnet core"], 1.0),
  s("NestJS", "framework", ["nest.js"], 1.0),
  s("gRPC", "architecture", ["grpc"], 1.1),
  s("GraphQL", "architecture", ["apollo"], 1.1),
  s("REST API", "architecture", ["rest", "restful", "rest apis", "restful api"], 1.2),
  s("WebSocket", "architecture", ["websockets", "socket.io"], 1.0),
  s("OpenAPI", "architecture", ["swagger"], 0.9),

  // --- Databases ----------------------------------------------------------
  s("PostgreSQL", "database", ["postgres", "psql", "postgresql"], 1.3),
  s("MySQL", "database", ["mariadb"], 1.2),
  s("MongoDB", "database", ["mongo"], 1.1),
  s("Redis", "database", [], 1.2),
  s("DynamoDB", "database", ["dynamo"], 1.1),
  s("Cassandra", "database", [], 1.0),
  s("Elasticsearch", "database", ["opensearch", "elastic search"], 1.1),
  s("SQLite", "database", [], 0.8),
  s("Neo4j", "database", ["graph database"], 0.9),
  s("Snowflake", "database", [], 1.1),
  s("BigQuery", "database", ["big query"], 1.1),
  s("Redshift", "database", [], 1.0),
  s("pgvector", "database", ["pg vector"], 1.1),
  s("Oracle", "database", ["oracle db", "plsql", "pl/sql"], 0.9),
  s("SQL Server", "database", ["mssql", "t-sql", "tsql"], 0.9),

  // --- Messaging / streaming ---------------------------------------------
  s("Kafka", "architecture", ["apache kafka"], 1.2),
  s("RabbitMQ", "architecture", ["rabbit mq"], 1.0),
  s("SQS", "architecture", ["amazon sqs"], 1.0),
  s("SNS", "architecture", ["amazon sns"], 0.9),
  s("Pub/Sub", "architecture", ["pubsub", "google pub/sub"], 0.9),
  s("Kinesis", "architecture", [], 1.0),

  // --- Cloud --------------------------------------------------------------
  s("AWS", "cloud", ["amazon web services"], 1.4),
  s("Azure", "cloud", ["microsoft azure"], 1.3),
  s("GCP", "cloud", ["google cloud", "google cloud platform"], 1.3),
  s("Lambda", "cloud", ["aws lambda"], 1.2),
  s("S3", "cloud", ["amazon s3"], 1.1),
  s("EC2", "cloud", ["amazon ec2"], 1.1),
  s("ECS", "cloud", ["amazon ecs", "fargate"], 1.1),
  s("EKS", "cloud", ["amazon eks"], 1.1),
  s("ECR", "cloud", [], 0.9),
  s("CloudWatch", "observability", ["cloud watch"], 1.0),
  s("IAM", "security", ["aws iam", "identity and access management"], 1.1),
  s("CDK", "devops", ["aws cdk", "cloud development kit"], 1.1),
  s("CloudFormation", "devops", ["cloud formation"], 1.0),
  s("Terraform", "devops", ["hcl"], 1.3),
  s("Pulumi", "devops", [], 0.9),
  s("Ansible", "devops", [], 1.0),
  s("Serverless", "architecture", ["serverless architecture"], 1.1),
  s("API Gateway", "cloud", [], 1.0),
  s("Cloudflare", "cloud", ["cloudflare workers"], 0.9),
  s("Vercel", "cloud", [], 0.8),

  // --- DevOps -------------------------------------------------------------
  s("Docker", "devops", ["containerization", "containerisation", "containers"], 1.3),
  s("Kubernetes", "devops", ["k8s", "kube"], 1.3),
  s("Helm", "devops", [], 0.9),
  s("CI/CD", "devops", ["ci cd", "continuous integration", "continuous delivery", "continuous deployment"], 1.3),
  s("Jenkins", "devops", [], 1.0),
  s("GitHub Actions", "devops", ["github action"], 1.1),
  s("GitLab CI", "devops", ["gitlab"], 1.0),
  s("CircleCI", "devops", ["circle ci"], 0.9),
  s("ArgoCD", "devops", ["argo cd", "gitops"], 1.0),
  s("Git", "devops", ["version control"], 1.0),
  s("Linux", "devops", ["unix", "linux/unix"], 1.0),
  s("Nginx", "devops", [], 0.9),
  s("Microservices", "architecture", ["microservice", "micro-services"], 1.2),

  // --- Observability ------------------------------------------------------
  s("Prometheus", "observability", [], 1.1),
  s("Grafana", "observability", [], 1.1),
  s("Datadog", "observability", ["data dog"], 1.1),
  s("Splunk", "observability", [], 1.0),
  s("OpenTelemetry", "observability", ["otel", "open telemetry"], 1.1),
  s("New Relic", "observability", [], 0.9),
  s("PagerDuty", "observability", ["on-call", "oncall"], 0.9),
  s("Sentry", "observability", [], 0.8),
  s("ELK", "observability", ["elk stack", "logstash", "kibana"], 0.9),
  s("Observability", "observability", ["monitoring", "telemetry"], 1.1),

  // --- Architecture / systems --------------------------------------------
  s("Distributed Systems", "architecture", ["distributed system"], 1.3),
  s("System Design", "architecture", [], 1.2),
  s("Scalability", "architecture", ["scalable", "scale"], 1.1),
  s("High Availability", "architecture", ["ha", "fault tolerance", "fault-tolerant", "resilience"], 1.1),
  s("Load Balancing", "architecture", ["load balancer"], 1.0),
  s("Caching", "architecture", ["cache", "cdn"], 1.1),
  s("Sharding", "architecture", ["partitioning"], 1.0),
  s("Replication", "architecture", [], 1.0),
  s("Event-Driven", "architecture", ["event driven", "event sourcing", "cqrs"], 1.1),
  s("Service Mesh", "architecture", ["istio", "linkerd"], 0.9),
  s("Concurrency", "architecture", ["multithreading", "parallelism", "async"], 1.1),
  s("Performance Tuning", "practice", ["performance optimization", "profiling", "latency optimization"], 1.1),

  // --- AI / ML ------------------------------------------------------------
  s("Machine Learning", "ai", ["ml"], 1.3),
  s("Deep Learning", "ai", ["neural networks"], 1.2),
  s("NLP", "ai", ["natural language processing"], 1.2),
  s("Computer Vision", "ai", ["cv", "image recognition"], 1.2),
  s("PyTorch", "ai", ["torch"], 1.2),
  s("TensorFlow", "ai", ["tf", "keras"], 1.2),
  s("scikit-learn", "ai", ["sklearn", "scikit learn"], 1.1),
  s("Pandas", "ai", [], 1.0),
  s("NumPy", "ai", ["numpy"], 1.0),
  s("LLM", "ai", ["large language model", "large language models", "gpt", "foundation model"], 1.3),
  s("RAG", "ai", ["retrieval augmented generation", "retrieval-augmented"], 1.2),
  s("MLOps", "ai", ["ml ops"], 1.2),
  s("Vector Database", "ai", ["vector db", "embeddings", "semantic search"], 1.1),
  s("Hugging Face", "ai", ["huggingface", "transformers"], 1.0),
  s("Prompt Engineering", "ai", [], 0.9),
  s("Recommendation Systems", "ai", ["recommender", "recommendation engine"], 1.1),

  // --- Data ---------------------------------------------------------------
  s("ETL", "data", ["elt", "data pipeline", "data pipelines"], 1.2),
  s("Airflow", "data", ["apache airflow"], 1.1),
  s("Spark", "data", ["apache spark", "pyspark"], 1.2),
  s("Hadoop", "data", ["mapreduce"], 0.9),
  s("dbt", "data", [], 1.0),
  s("Data Warehouse", "data", ["data warehousing", "data lake"], 1.0),
  s("Stream Processing", "data", ["streaming", "flink"], 1.0),
  s("Data Modeling", "data", ["schema design", "data modelling"], 1.0),
  s("Tableau", "data", ["power bi", "looker"], 0.8),

  // --- Testing ------------------------------------------------------------
  s("Unit Testing", "testing", ["unit tests"], 1.1),
  s("Integration Testing", "testing", ["integration tests"], 1.1),
  s("End-to-End Testing", "testing", ["e2e", "end to end testing"], 1.0),
  s("TDD", "testing", ["test driven development", "test-driven"], 1.0),
  s("PyTest", "testing", ["pytest"], 1.0),
  s("JUnit", "testing", ["junit5"], 1.0),
  s("Jest", "testing", ["vitest"], 1.0),
  s("Mockito", "testing", ["mocking"], 0.9),
  s("Playwright", "testing", [], 1.0),
  s("Selenium", "testing", [], 0.9),
  s("Cypress", "testing", [], 0.9),
  s("Test Coverage", "testing", ["code coverage", "jacoco"], 1.0),

  // --- Security -----------------------------------------------------------
  s("OAuth", "security", ["oauth2", "oauth 2.0"], 1.1),
  s("JWT", "security", ["json web token"], 1.0),
  s("SAML", "security", ["sso", "single sign-on"], 1.0),
  s("Encryption", "security", ["cryptography", "tls", "ssl"], 1.0),
  s("OWASP", "security", ["owasp top 10"], 1.0),
  s("Penetration Testing", "security", ["pen testing", "pentest"], 1.0),
  s("SOC 2", "security", ["soc2", "compliance", "hipaa", "gdpr"], 1.0),
  s("Threat Modeling", "security", ["threat modelling"], 1.0),
  s("Zero Trust", "security", [], 0.9),

  // --- Practices ----------------------------------------------------------
  s("Agile", "practice", ["scrum", "kanban", "sprint"], 0.9),
  s("Code Review", "practice", ["peer review"], 1.0),
  s("Design Patterns", "practice", ["gang of four"], 1.0),
  s("SOLID", "practice", ["solid principles"], 1.0),
  s("Object-Oriented", "practice", ["oop", "object oriented"], 1.0),
  s("Functional Programming", "practice", ["fp"], 0.9),
  s("Refactoring", "practice", ["technical debt"], 0.9),
  s("Data Structures", "practice", ["data structures and algorithms", "dsa"], 1.1),
  s("Algorithms", "practice", ["algorithm design"], 1.1),
  s("Debugging", "practice", ["troubleshooting", "root cause analysis"], 0.9),
  s("Documentation", "practice", ["technical writing"], 0.8),
  s("Mentoring", "soft", ["mentorship", "coaching"], 0.9),
  s("Cross-Functional", "soft", ["cross functional", "collaboration", "stakeholder"], 0.8),
  s("Ownership", "soft", ["end-to-end ownership"], 0.8),
  s("Communication", "soft", ["written communication", "verbal communication"], 0.7),
  s("Leadership", "soft", ["tech lead", "team lead"], 0.9),
];

/**
 * Reverse index from every surface form (canonical + aliases, lowercased) to
 * its canonical skill. Built once at module load.
 */
export const SKILL_INDEX: ReadonlyMap<string, Skill> = (() => {
  const map = new Map<string, Skill>();
  for (const skill of SKILLS) {
    map.set(skill.canonical.toLowerCase(), skill);
    for (const alias of skill.aliases) {
      // Never let an alias clobber another skill's canonical name.
      const key = alias.toLowerCase();
      if (!map.has(key)) map.set(key, skill);
    }
  }
  return map;
})();

/** All surface forms, longest first so multi-word phrases match before parts. */
export const SKILL_SURFACES: readonly string[] = Array.from(SKILL_INDEX.keys()).sort(
  (a, b) => b.length - a.length,
);

/**
 * Words that carry no signal in a job posting. Deliberately excludes technical
 * terms so nothing meaningful is filtered out.
 */
export const STOPWORDS: ReadonlySet<string> = new Set([
  "the","and","for","with","you","your","our","are","will","that","this","have","has","from",
  "they","their","who","what","when","where","how","all","any","can","out","use","using","used",
  "work","working","team","teams","role","job","position","company","experience","years","year",
  "strong","good","great","excellent","ability","able","including","include","includes","such",
  "more","most","other","others","new","across","within","into","also","well","help","helps",
  "make","makes","build","building","look","looking","join","joining","we","us","be","is","it",
  "as","at","on","in","to","of","or","an","a","by","not","but","if","so","than","then","these",
  "those","there","here","about","over","under","via","per","may","must","should","would","could",
  "like","both","each","every","some","many","much","very","just","only","own","same","while",
  "after","before","during","through","between","among","been","being","was","were","do","does",
  "did","get","gets","got","go","goes","one","two","three","first","second","next","last","plus",
  "etc","ideal","ideally","preferred","required","requirements","responsibilities","qualifications",
  "skills","skill","bonus","nice","opportunity","opportunities","environment","culture","benefits",
  "apply","applicants","candidate","candidates","please","equal","employer","diversity","inclusive",
  "salary","compensation","range","based","full","time","part","hybrid","remote","onsite","office",
  "please","note","applicant","hiring","interview","process","resume","cover","letter","contact",
  "email","phone","address","website","learn","learning","grow","growth","career","develop",
  "development","developer","engineer","engineering","software","technology","technical","technologies",
  "product","products","business","customer","customers","user","users","solution","solutions",
  "project","projects","support","supporting","ensure","ensuring","provide","providing","deliver",
  "delivering","drive","driving","lead","leading","manage","managing","create","creating","design",
  "designing","implement","implementing","maintain","maintaining","improve","improving","partner",
  "partnering","collaborate","collaborating","identify","identifying","understand","understanding",
  "knowledge","familiarity","proficiency","proficient","expertise","expert","background","degree",
  "bachelor","master","phd","university","college","computer","science","related","field","equivalent",
  "practical","hands","minimum","preferred","desired","similar","relevant","successful","success",
  "high","quality","best","practices","practice","standards","standard","level","levels","senior",
  "junior","staff","principal","intern","internship","new","grad","graduate","entry",
]);

/** Resolves any surface form to its canonical skill, if known. */
export function resolveSkill(term: string): Skill | undefined {
  return SKILL_INDEX.get(term.trim().toLowerCase());
}

/** Canonical display name for a term, falling back to the input. */
export function canonicalize(term: string): string {
  return resolveSkill(term)?.canonical ?? term.trim();
}
