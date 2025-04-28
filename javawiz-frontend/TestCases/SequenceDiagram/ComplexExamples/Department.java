public class Department {
  public int id;
  public String name;

  public Department(int id, String name) {
    this.id = id;
    this.name = name;
  }

  public String getIdentifier() {
    return String.format("%02d-%s", id, name);
  }
}
