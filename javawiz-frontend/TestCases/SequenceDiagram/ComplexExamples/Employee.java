public class Employee {
  public String name;
  public Department dept;
  public double salary;

  public Employee(String name, Department dept, double salary) {
    this.name = name;
    this.dept = dept;
    this.salary = salary;
  }

  public Employee(String name, Department dept) {
    this(name, dept, 1000.0);
  }

  public Employee(String name) {
    this(name, null);
  }

  public boolean raiseSalary(double salary) {
    if (salary > this.salary) {
      this.salary = salary;
      return true;
    }
    return false;
  }

  public void print() {
    Out.println(String.format("Employee %s (department: %s, salary: %.2f)", name,
        dept == null ? "-" : dept.getIdentifier(), salary));
  }
}
