from ..repositories.json_repository import read
def all_of(name): return read(name,[])
def find_by(name,field,value): return next((x for x in all_of(name) if x.get(field)==value),None)
def professional_for(username): return find_by('profesionales.json','username',username)
def patient_for(username): return find_by('pacientes.json','username',username)
def patient(patient_id): return find_by('pacientes.json','id',patient_id)
def entity(entity_id): return find_by('entidades.json','id',entity_id)
