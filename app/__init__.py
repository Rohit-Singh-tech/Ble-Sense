import os
import sys

# Extend package path so imports of `app.*` resolve to `backend/app/*`
_backend_app = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend", "app"))
if os.path.exists(_backend_app) and _backend_app not in __path__:
    __path__.append(_backend_app)

# Ensure backend root is in sys.path
_backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if os.path.exists(_backend_root) and _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)
