# Lab cloud-iam-sim

Room: **containers-y-cloud** (task adicional, Tier 3). Misconfigurations AWS simuladas.

## Uso
```bash
cp flags.env.example flags.env
docker compose --env-file flags.env up -d
# http://127.0.0.1:18115
```

| Pecado | Ruta (la real en AWS) |
|---|---|
| IMDS creds | `/aws/latest/meta-data/iam/security-credentials/ec2-web-role` (169.254.169.254) |
| Bucket S3 público | `/s3/buckets` → `corp-internal-tools` (tfstate + secrets.env) |
| IAM wildcard | `/iam/policies` → Action * on Resource * |

Flags: F1 IMDS, F2 bucket público (tfstate/secrets.env), F3 wildcard policy.
