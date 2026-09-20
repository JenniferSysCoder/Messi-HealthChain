class NodeData:
    # Acá se define la clase NodeData que representa la información de un nodo en la red blockchain, incluyendo su nombre, dirección IP y número de socket
    def __init__(self, pnodeName, pIPAddress, psocketNum):
        self.node_name = pnodeName
        self.ip_address = pIPAddress
        self.socket_num = psocketNum

    def get_node_name(self):
        return self.node_name

    def get_ip_address(self):
        return self.ip_address

    def get_socket_num(self):
        return self.socket_num
