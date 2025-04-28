public class EmployeeApplication {
  public static void main(String[] args) {
    Department sales = new Department(1, "Sales");
    Department it = new Department(2, "IT");

    Employee e0 = new Employee("Eric", sales);
    Employee e1 = new Employee("Susan", it, 2000.0);
    Employee e2 = new Employee("Annie");
    Employee e3 = new Employee("Steve");

    e0.print();
    e1.print();
    e2.print();
    e3.print();

    if (e2.raiseSalary(1950.0)) {
      Out.println("Raised salary of employee to 1950.00");
    } else {
      Out.println("Could not raise salary to 1950.00");
    }
    e2.print();
    if (e3.raiseSalary(900.0)) {
      Out.println("Raised salary of employee to 900.00");
    } else {
      Out.println("Could not raise salary to 900.00");
    }
    e3.print();
  }
}
