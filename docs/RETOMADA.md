# Retomada após reiniciar o Windows

Bloqueio confirmado: Docker Desktop exige reinicialização para concluir os recursos WSL habilitados. Não foi realizada reinicialização automática.

1. Salve seu trabalho e reinicie manualmente o Windows.
2. Abra Docker Desktop. Leia/aceite os termos se concordar e aguarde o engine Linux.
3. Volte a esta tarefa e diga “Reiniciei; vamos concluir os deploys”.

Verificação inicial em PowerShell:

```powershell
$dockerExe = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin/docker.exe'
& $dockerExe info --format '{{.OSType}}'
& $dockerExe compose version
```

O primeiro comando deve retornar `linux`, não apenas uma versão de cliente. Se falhar, diagnosticar antes de habilitar deploy.

Próximas ações:

- Preparar runner Windows x64 efêmero com label `ecohospital-lab` no repositório Kalicon/ecohospital-esg-cicd. Nunca executar PR externo no PC; testes/build permanecem nos runners GitHub.
- Habilitar LOCAL_DEPLOY_ENABLED=true e LOCAL_PRODUCTION_DEPLOY_ENABLED=true, hoje false.
- Executar CI/CD na main. Staging deve passar antes de production; manter revisão obrigatória no Environment production. Runner efêmero atende um job: preparar outro para produção.
- Validar página/health, UID, Compose, redes/volumes separados, isolamento e persistência. Registrar mesmo digest/SHA.
- Inserir prints reais, atualizar documentação/PDF e gerar novo ZIP sem sobrescrever entregas anteriores.

O deploy mantém arquivos fora do checkout, em `%LOCALAPPDATA%\EcoHospital\deploy\staging` e `production`. Portas planejadas 8081/8082, somente loopback. Nenhum volume desses ambientes foi criado ainda.

Comprovado: 25 JUnit e runner Node aprovados; CI aprovado; Docker executado no GitHub e GHCR publicado; PR falho bloqueou imagem/deploy e foi encerrado sem merge. Links/logs em README e docs/evidence/github. Sem necessidade de servidor pago no modo escolhido.
