public class RepeatedDetailedTask extends DetailedTask {
  public int nExecutions;

  public RepeatedDetailedTask(String title, int priority, String[] subTasks, int nExecutions) {
    super(title, priority, subTasks);
    this.nExecutions = nExecutions;
  }

  @Override
  public String getDescription() {
    return super.getDescription() + " x" + nExecutions;
  }

  @Override
  public void execute() {
    for (int i = 0; i < nExecutions; i++) {
      super.execute();
    }
  }
}
