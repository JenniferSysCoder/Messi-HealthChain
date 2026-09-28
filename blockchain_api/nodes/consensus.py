class ConsensusManager:
    def __init__(self, blockchain):
        self.blockchain = blockchain

    def validate_block(self, block):
        if block is None or self.blockchain.block_exist(block):
            return False
        if not self.blockchain.get_proof_of_work_over_block(block):
            return False
        if self.blockchain.size() == 0:
            return block.get_id() == 0
        last = self.blockchain.get_last_block()
        return (
            block.get_id() == last.get_id() + 1
            and block.get_previous_hash() == last.get_hash()
        )

    def accept_block(self, block):
        if not self.validate_block(block):
            return False
        return self.blockchain.add_proved_block(block)
