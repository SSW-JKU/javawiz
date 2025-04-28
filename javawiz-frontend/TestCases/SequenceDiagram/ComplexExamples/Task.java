public class Task {
  public String title;
  public int priority;

  public Task(String title, int priority) {
    this.title = title;
    this.priority = priority;
  }

  public Task(String title) {
    this(title, 1);
  }

  public String getDescription() {
    return String.format("%s (%d)", title, priority);
  }

  public void execute() {
    Out.println(String.format("Executing task: %s", getDescription()));
  }
}
