import java.util.Arrays;

public class DetailedTask extends Task {
  public String[] subTasks;

  public DetailedTask(String title, int priority, String... subTasks) {
    super(title, priority);
    this.subTasks = subTasks;
  }

  public DetailedTask(String title, String... subTasks) {
    this(title, subTasks.length, subTasks);
  }

  @Override
  public String getDescription() {
    return super.getDescription() + " " + Arrays.toString(subTasks);
  }
}
