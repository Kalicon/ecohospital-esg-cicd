"""Check a delivery ZIP against its internal SHA256 manifest, using only stdlib."""
import hashlib
import sys
import zipfile
from pathlib import Path, PurePosixPath

root = Path(__file__).resolve().parents[1]
archive = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'delivery/EcoHospital_CICD.zip'
with zipfile.ZipFile(archive) as delivery:
    assert delivery.testzip() is None, 'ZIP integrity failure'
    names = delivery.namelist()
    assert len(names) == len(set(names)), 'Duplicate entries'
    for name in names:
        path = PurePosixPath(name)
        assert not path.is_absolute() and '..' not in path.parts, name
        assert not set(path.parts).intersection({'.git', 'target', '.runtime', '.tools', '__pycache__'}), name
        assert path.name != '.env' and not path.name.endswith('.env'), name
        assert path.suffix not in {'.pem', '.key', '.pfx', '.p12'}, name
        assert not (name.startswith('deploy/import/') and name.endswith('.json')), name
    required = ['pom.xml', 'Dockerfile', '.dockerignore', 'docker-compose.yml', 'docker-compose.postgres.yml', '.env.example',
                '.github/workflows/ci-cd.yml', '.github/workflows/deploy.yml', 'README.md',
                'docs/EcoHospital_CICD.pdf', '.mvn/wrapper/maven-wrapper.properties',
                'src/server.js', 'src/test_mongodb_runner.js', 'scripts/esg_mongodb_solution.js']
    for name in required:
        assert name in names, f'Missing required entry: {name}'
    manifest = delivery.read('MANIFEST-SHA256.txt').decode('utf-8').splitlines()
    checked = set()
    for line in manifest:
        expected, name = line.split('  ', 1)
        actual = hashlib.sha256(delivery.read(name)).hexdigest()
        assert actual == expected, f'Content hash mismatch: {name}'
        checked.add(name)
    assert checked == set(names) - {'MANIFEST-SHA256.txt'}, 'Manifest mismatch'
print(f'ZIP_OK: {archive.name}; {len(checked)} arquivos; CRC, manifesto SHA256 e exclusões conferidos.')
