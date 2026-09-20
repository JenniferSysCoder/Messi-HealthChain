import hashlib


class SHA256:
    @staticmethod
    def generate_hash(data):
        try:
            return hashlib.sha256(data.encode("utf-8")).hexdigest()
        except Exception as e:
            raise RuntimeError(e)
