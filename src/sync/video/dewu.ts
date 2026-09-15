import { logger } from "~utils/logger";
import type { SyncData, VideoData } from "../common";

export async function VideoDewu(data: SyncData) {
  // 简化说明：此版本专注于拖动策略，其他复杂策略已注释或移除以减少干扰
  logger.debug("🎬 VideoDewu函数被调用");
  logger.debug("📥 接收到的data参数:", data);

  // 防止重复执行
  if ((window as unknown as { __dewuRunning?: boolean }).__dewuRunning) {
    logger.debug("⚠️ Dewu脚本已在运行中，跳过重复执行");
    return;
  }
  (window as unknown as { __dewuRunning?: boolean }).__dewuRunning = true;

  logger.debug("🚀 开始执行Dewu视频发布脚本");

  /**
   * 创建一个在指定毫秒数后解析的 Promise
   * @param {number} ms - 等待的毫秒数
   * @returns {Promise<void>} 在指定时间后解析的 Promise
   */
  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function getVideoMetadata(): Promise<{
    duration: number;
    width: number;
    height: number;
  }> {
    // 基于用户反馈，直接使用 1280x720 作为默认尺寸
    return {
      duration: 0,
      width: 1280,
      height: 720,
    };
  }

  async function uploadVideo(file: File): Promise<void> {
    logger.debug("🎬 开始视频上传流程");

    await sleep(3000);

    // 确保在"发布视频"标签页
    const videoTab = document.querySelector("#rc-tabs-0-tab-1") as HTMLElement;
    if (videoTab && !videoTab.classList.contains("pd-tabs-tab-active")) {
      logger.debug("🖱️ 点击发布视频标签页");
      videoTab.click();
      await sleep(2000);
    }

    const fileInputs = document.querySelectorAll('input[type="file"]');
    logger.debug(`🔍 找到 ${fileInputs.length} 个文件输入框`);

    if (fileInputs.length === 0) {
      throw new Error("页面上没有找到任何文件输入框");
    }

    const videoInput = fileInputs[0] as HTMLInputElement;
    logger.debug("✅ 使用第一个文件输入框");

    logger.debug("📁 准备上传视频文件:", file.name, file.type, file.size);

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    videoInput.files = dataTransfer.files;

    const changeEvent = new Event("change", { bubbles: true });
    videoInput.dispatchEvent(changeEvent);

    logger.debug("✅ 视频文件设置完成，开始上传...");

    // 立即返回，不等待上传完成
    return;
  }

  async function waitForUploadCompletion(timeout = 30000): Promise<void> {
    logger.debug("⏳ 等待视频上传完成...");
    await sleep(timeout);
    logger.debug("✅ 视频上传等待完成，继续执行");
  }

  async function fillTitle(title: string): Promise<void> {
    logger.debug("🔍 开始填写标题:", title);

    // 等待页面完全加载
    await sleep(3000);

    // 直接使用 id="title" 填充
    const titleInput = document.getElementById("title") as HTMLInputElement;

    if (titleInput) {
      titleInput.value = title;
      titleInput.dispatchEvent(new Event("input", { bubbles: true }));
      titleInput.dispatchEvent(new Event("change", { bubbles: true }));
      logger.debug("✅ 标题已填写:", title);
      return;
    }

    logger.debug("⚠️ 未找到标题输入框");
  }

  async function fillDescription(content: string): Promise<void> {
    logger.debug("🔍 开始填写描述:", content);

    // 等待页面完全加载
    await sleep(5000);

    // 创建临时元素来处理HTML标签
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = content;
    const plainText = tempDiv.textContent || tempDiv.innerText || "";

    logger.debug("🔍 查找描述输入框，目标内容:", plainText);

    // 使用简单的选择器找到描述输入框
    const descriptionSelectors = [
      'div[contenteditable="true"][data-placeholder="填写完整的描述信息"]',
      'div[contenteditable="true"]',
      '[data-placeholder*="描述"]',
      '[data-placeholder*="内容"]',
      '[data-placeholder*="动态"]',
      "textarea",
    ];

    for (const selector of descriptionSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const el = element as HTMLElement | HTMLTextAreaElement;
        if (el.offsetParent !== null) {
          logger.debug(`✅ 找到描述输入框: ${selector}`);

          // 根据元素类型选择填写方式
          if (el.contentEditable === "true") {
            // contenteditable div
            (el as HTMLElement).innerText = plainText;
          } else if (el.tagName === "TEXTAREA") {
            // textarea
            (el as HTMLTextAreaElement).value = plainText;
          } else {
            // 其他输入框
            (el as HTMLInputElement).value = plainText;
          }

          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          el.dispatchEvent(new Event("blur", { bubbles: true }));

          logger.debug("✅ 描述已填写:", `${plainText.substring(0, 100)}...`);
          return;
        }
      }
    }

    logger.debug("⚠️ 未找到描述输入框");
  }

  async function uploadCover(
    cover: { url: string; name: string; type?: string },
    videoAspectRatio: number,
  ): Promise<void> {
    logger.debug("🖼️ 开始上传封面:", cover);

    try {
      // 步骤1: 点击"编辑封面"按钮
      logger.debug("🔍 查找编辑封面按钮...");

      // 通过文本内容查找按钮，避免使用动态CSS类
      const buttons = document.querySelectorAll("button");
      let editCoverButton: HTMLElement | null = null;

      for (const button of buttons) {
        const text = button.textContent?.trim();
        if (text?.includes("编辑封面")) {
          editCoverButton = button as HTMLElement;
          logger.debug("✅ 通过文本找到编辑封面按钮");
          break;
        }
      }

      if (!editCoverButton) {
        logger.debug('❌ 未找到编辑封面按钮，尝试查找包含"封面"的按钮...');
        for (const button of buttons) {
          const text = button.textContent?.trim();
          if (text?.includes("封面")) {
            editCoverButton = button as HTMLElement;
            logger.debug("✅ 通过部分文本找到编辑封面按钮");
            break;
          }
        }
      }

      if (!editCoverButton) {
        logger.debug("❌ 未找到编辑封面按钮");
        return;
      }

      logger.debug("✅ 点击编辑封面按钮");
      editCoverButton.click();
      await sleep(3000);

      // 步骤2: 点击"上传封面"标签页
      logger.debug("🔍 查找上传封面标签页...");
      const uploadCoverTabSelectors = [
        "#rc-tabs-1-tab-2", // 具体的ID
        'div[role="tab"]:contains("上传封面")', // 通过文本查找
        '.pd-tabs-tab:contains("上传封面")', // 通过类和文本查找
      ];

      let uploadCoverTab: HTMLElement | null = null;
      for (const selector of uploadCoverTabSelectors) {
        if (selector.includes(":contains")) {
          const tabs = document.querySelectorAll('[role="tab"]');
          for (const tab of tabs) {
            if (tab.textContent?.includes("上传封面")) {
              uploadCoverTab = tab as HTMLElement;
              logger.debug("✅ 通过文本找到上传封面标签页");
              break;
            }
          }
        } else {
          uploadCoverTab = document.querySelector(selector) as HTMLElement;
        }

        if (uploadCoverTab) {
          logger.debug(`✅ 找到上传封面标签页: ${selector}`);
          break;
        }
      }

      if (uploadCoverTab) {
        logger.debug("✅ 点击上传封面标签页");
        uploadCoverTab.click();
        await sleep(2000);
      }

      // 步骤3: 查找上传区域并触发文件上传
      logger.debug("🔍 查找上传区域...");

      // 查找包含上传文本的元素
      const uploadTextElements = Array.from(document.querySelectorAll("*")).filter((el) => {
        const text = el.textContent?.trim();
        return text?.includes("将文件拖拽到这里") && text.includes("支持jpg");
      });

      let uploadArea: HTMLElement | null = null;

      if (uploadTextElements.length > 0) {
        // 找到包含上传文本的元素，然后向上查找其父级容器
        uploadArea = uploadTextElements[0].closest("div") as HTMLElement;
        logger.debug("✅ 通过文本找到上传区域");
      } else {
        // 备用方案：查找包含上传图标的区域
        const uploadImages = Array.from(document.querySelectorAll("img")).filter((img) => {
          const src = img.src.toLowerCase();
          return src.includes("upload") || src.includes("add") || src.includes("plus");
        });

        if (uploadImages.length > 0) {
          uploadArea = uploadImages[0].closest("div") as HTMLElement;
          logger.debug("✅ 通过图标找到上传区域");
        }
      }

      if (!uploadArea) {
        logger.debug("❌ 未找到上传区域，尝试所有可能的div容器...");
        // 最后的备用方案：查找模态框内的大div
        const modalDivs = Array.from(document.querySelectorAll('.modal *, .dialog *, [role="dialog"] *'));
        for (const div of modalDivs) {
          if (div.tagName === "DIV" && div.children.length > 0) {
            uploadArea = div as HTMLElement;
            logger.debug("✅ 使用模态框内的div作为上传区域");
            break;
          }
        }
      }

      if (!uploadArea) {
        logger.debug("❌ 未找到上传区域");
        return;
      }

      // 步骤4: 准备封面文件
      logger.debug("📁 准备封面文件...");
      const response = await fetch(cover.url);
      const arrayBuffer = await response.arrayBuffer();
      const coverFile = new File([arrayBuffer], cover.name, {
        type: cover.type || "image/jpeg",
      });

      logger.debug("📁 封面文件信息:", coverFile.name, coverFile.size, coverFile.type);

      // 方法1: 查找现有的文件输入框
      logger.debug("🔍 查找现有的文件输入框...");
      const fileInputs = uploadArea.querySelectorAll('input[type="file"]');
      let targetFileInput: HTMLInputElement | null = null;

      if (fileInputs.length > 0) {
        targetFileInput = fileInputs[0] as HTMLInputElement;
        logger.debug("✅ 找到现有文件输入框");
      } else {
        // 方法2: 创建文件输入框
        logger.debug("📝 创建新的文件输入框...");
        targetFileInput = document.createElement("input");
        targetFileInput.type = "file";
        targetFileInput.accept = "image/*,.jpg,.jpeg,.png,.webp";
        targetFileInput.style.display = "none";
        targetFileInput.id = `dewu_cover_upload_${Date.now()}`;
        document.body.appendChild(targetFileInput);
      }

      // 设置文件
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(coverFile);
      targetFileInput.files = dataTransfer.files;

      // 触发文件选择事件
      logger.debug("📤 触发文件选择事件...");
      targetFileInput.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      await sleep(1000);

      // 方法3: 直接点击上传区域触发文件选择
      logger.debug("🖱️ 尝试直接点击上传区域...");
      uploadArea.click();
      await sleep(1000);

      // 清理临时创建的文件输入框
      if (targetFileInput.id.startsWith("dewu_cover_upload_")) {
        targetFileInput.remove();
      }

      logger.debug("✅ 封面文件设置完成");

      // 步骤5: 等待上传完成并选择封面比例
      logger.debug("⏳ 等待封面上传完成...");
      await sleep(5000);

      // 根据视频比例选择合适的封面裁剪比例
      logger.debug("🎯 根据视频比例选择封面裁剪比例:", videoAspectRatio.toFixed(2));
      await selectCoverAspectRatio(videoAspectRatio);
    } catch (error) {
      logger.error("❌ 封面上传失败:", error);
    }
  }

  // 关闭封面上传模态框的独立函数
  async function closeCoverModal(): Promise<void> {
    logger.debug("🔍 查找模态框确定按钮...");
    const confirmButtonSelectors = [
      'button:contains("确定")', // 通过文本查找
      ".pd-modal-footer .pd-btn-primary", // 模态框 footer 中的主要按钮
      ".ant-modal-footer .ant-btn-primary", // Ant Design 模态框
      '[class*="modal"] [class*="confirm"]', // 包含确认类名的按钮
      '.pd-btn-primary:contains("确定")', // 主要按钮且包含确定文本
    ];

    let confirmButton: HTMLElement | null = null;
    for (const selector of confirmButtonSelectors) {
      if (selector.includes(":contains")) {
        const buttons = document.querySelectorAll("button");
        for (const button of buttons) {
          if (button.textContent?.includes("确定") && button.textContent?.length <= 10) {
            // 确保按钮文本相对简短，避免匹配到其他包含"确定"的长文本
            confirmButton = button as HTMLElement;
            logger.debug("✅ 通过文本找到确定按钮");
            break;
          }
        }
      } else {
        confirmButton = document.querySelector(selector) as HTMLElement;
      }

      if (confirmButton && confirmButton.offsetParent !== null) {
        logger.debug(`✅ 找到确定按钮: ${selector}`);
        break;
      }
    }

    if (confirmButton) {
      logger.debug("✅ 点击确定按钮完成封面上传");
      confirmButton.click();
      await sleep(3000);
      logger.debug("🎉 封面上传完成");
    } else {
      logger.debug("⚠️ 未找到确定按钮，可能需要手动确认");
    }
  }

  async function selectCoverAspectRatio(videoAspectRatio: number): Promise<void> {
    logger.debug("🎯 开始选择封面裁剪比例，视频比例:", videoAspectRatio.toFixed(2));

    try {
      // 根据视频比例确定推荐的封面裁剪比例
      let recommendedRatio = "";
      if (videoAspectRatio >= 1.5) {
        // 横版视频 (3:2 或更宽)
        recommendedRatio = "4:3"; // 横版视频优先选择 4:3
      } else if (videoAspectRatio >= 0.8) {
        // 接近正方形的视频
        recommendedRatio = "1:1";
      } else {
        // 竖版视频
        recommendedRatio = "3:4"; // 竖版视频选择 3:4
      }

      logger.debug("📏 推荐封面裁剪比例:", recommendedRatio);

      // 查找并选择推荐的比例
      const allElements = document.querySelectorAll("*");
      let selectedOption: HTMLElement | null = null;

      // 优先选择推荐比例
      for (const element of allElements) {
        const text = element.textContent?.trim();
        if (text === recommendedRatio) {
          selectedOption = element as HTMLElement;
          logger.debug(`✅ 找到推荐比例: ${recommendedRatio}`);
          break;
        }
      }

      // 如果没找到推荐比例，选择4:3（对于横版视频）
      if (!selectedOption && recommendedRatio === "4:3") {
        for (const element of allElements) {
          const text = element.textContent?.trim();
          if (text === "4:3") {
            selectedOption = element as HTMLElement;
            logger.debug("✅ 找到4:3比例");
            break;
          }
        }
      }

      // 点击选择的选项
      if (selectedOption) {
        logger.debug("✅ 点击封面裁剪比例选项");
        selectedOption.click();
        await sleep(3000); // 增加等待时间，确保裁剪界面完全加载
        logger.debug("✅ 封面裁剪比例选择完成");

        // 执行智能撑满和居中策略，确保cropper完全初始化
        logger.debug("🎯 开始执行智能裁剪框调整...");
        await smartExpandAndCenterCropBox();
        logger.debug("✅ 智能裁剪框调整完成");

        // 在智能裁剪完成后再关闭模态框
        await closeCoverModal();
      } else {
        logger.debug("⚠️ 未找到封面裁剪比例选择选项，跳过此步骤");
        // 即使没有选择比例，也要尝试关闭模态框
        await closeCoverModal();
      }
    } catch (error) {
      logger.error("❌ 封面裁剪比例选择失败:", error);
    }
  }

  // 智能撑满和居中策略 - 纯Cropper API
  async function smartExpandAndCenterCropBox(): Promise<void> {
    logger.debug("🎯 开始使用Cropper API撑满和居中裁剪框...");

    // 等待cropper完全初始化，并尝试多次查找实例
    let cropperInstance = null;
    let attempts = 0;
    const maxAttempts = 10;

    while (!cropperInstance && attempts < maxAttempts) {
      logger.debug(`🔍 尝试查找Cropper实例 (${attempts + 1}/${maxAttempts})...`);

      // 等待时间递减，第一次长一些，后面短一些
      const waitTime = attempts === 0 ? 3000 : 1000;
      await sleep(waitTime);

      cropperInstance = findCropperInstance();
      attempts++;
    }

    if (!cropperInstance) {
      logger.error("❌ 多次尝试后仍未找到Cropper实例");
      // 提供调试信息
      logger.debug(
        "🔍 当前页面元素:",
        document.querySelectorAll('canvas, .cropper-container, [class*="cropper"]').length,
      );
      return;
    }

    logger.debug("✅ 找到Cropper实例，使用API调整");
    await adjustUsingCropperAPI(cropperInstance);
  }

  // 查找Cropper实例
  function findCropperInstance(): unknown {
    logger.debug("🔍 查找Cropper实例...");

    // 直接查找cropper-hidden的canvas元素
    const hiddenCanvas = document.querySelector("canvas.cropper-hidden");
    logger.debug("hiddenCanvas:", hiddenCanvas);
    const cropperInstance = hiddenCanvas && (hiddenCanvas as { cropper?: unknown }).cropper;
    logger.debug("cropperInstance:", cropperInstance);

    if (cropperInstance) {
      logger.debug("✅ 在canvas.cropper-hidden找到Cropper实例");
      return cropperInstance;
    }

    logger.debug("❌ 未找到Cropper实例");
    return null;
  }

  // 使用Cropper API设置最优裁剪框
  async function adjustUsingCropperAPI(cropperInstance: unknown): Promise<void> {
    try {
      logger.debug("=== 设置最优裁剪框尺寸 ===");

      if (!cropperInstance) {
        logger.error("❌ 未找到Cropper实例");
        return;
      }

      // 类型断言为 Cropper 实例
      const cropper = cropperInstance as {
        getImageData: () => { naturalWidth: number; naturalHeight: number };
        getContainerData: () => { width: number; height: number };
        setCropBoxData: (data: { left: number; top: number; width: number; height: number }) => void;
        render: () => void;
        getCropBoxData: () => { left: number; top: number; width: number; height: number };
      };

      // 验证cropper实例是否有必要的方法
      if (
        typeof cropper.getImageData !== "function" ||
        typeof cropper.setCropBoxData !== "function" ||
        typeof cropper.render !== "function"
      ) {
        logger.error("❌ Cropper实例缺少必要的方法");
        return;
      }

      // 获取实际的图片数据并设置最大可能的裁剪框
      const cropperContainerData = cropper.getContainerData();

      // 计算在4:3比例下的最大尺寸
      const containerAspectRatio = cropperContainerData.width / cropperContainerData.height;
      const targetAspectRatio = 4 / 3;

      let optimalWidth: number;
      let optimalHeight: number;
      let optimalLeft: number;
      let optimalTop: number;

      if (containerAspectRatio > targetAspectRatio) {
        // 容器更宽，以高度为准
        optimalHeight = cropperContainerData.height;
        optimalWidth = optimalHeight * targetAspectRatio;
        optimalLeft = (cropperContainerData.width - optimalWidth) / 2;
        optimalTop = 0;
      } else {
        // 容器更高，以宽度为准
        optimalWidth = cropperContainerData.width;
        optimalHeight = optimalWidth / targetAspectRatio;
        optimalLeft = 0;
        optimalTop = (cropperContainerData.height - optimalHeight) / 2;
      }

      const optimalCropBoxData = {
        left: optimalLeft,
        top: optimalTop,
        width: optimalWidth,
        height: optimalHeight,
      };

      logger.debug("设置最优裁剪框:", optimalCropBoxData);

      // 应用设置
      cropper.setCropBoxData(optimalCropBoxData);
      cropper.render();

      // 验证结果
      await new Promise((resolve) => setTimeout(resolve, 300));

      const result = cropper.getCropBoxData();

      const widthCoverage = (result.width / cropperContainerData.width) * 100;
      const heightCoverage = (result.height / cropperContainerData.height) * 100;

      logger.debug("✅ 设置完成！");
      logger.debug("最终裁剪框:", result);
      logger.debug("容器覆盖率:", `${widthCoverage.toFixed(1)}% x ${heightCoverage.toFixed(1)}%`);
      logger.debug("🎉 这是4:3比例下的最大尺寸！");
    } catch (error) {
      logger.error("❌ Cropper API调用失败:", error);
    }
  }

  // ========== 注释掉所有拖动相关函数 ==========
  // 拖动策略太复杂，已放弃
  /*
  [所有拖动相关函数已注释]
  */

  // 主执行逻辑
  try {
    logger.debug("🔍 开始数据结构检查");
    logger.debug("📝 data参数:", data);

    if (!data || !data.data) {
      logger.error("❌ 数据参数为空");
      return;
    }

    const { content, video, title, tags, cover } = data.data as VideoData;

    if (!video) {
      logger.error("❌ 缺少视频文件");
      return;
    }

    // 获取视频元数据
    const metadata = await getVideoMetadata();
    const aspectRatio = metadata.width / metadata.height;
    logger.debug("📊 视频信息:", {
      width: metadata.width,
      height: metadata.height,
      aspectRatio: aspectRatio.toFixed(2),
    });

    // 下载视频文件
    logger.debug("📥 开始下载视频文件...");
    const response = await fetch(video.url);
    const arrayBuffer = await response.arrayBuffer();
    const videoFile = new File([arrayBuffer], video.name, {
      type: video.type,
    });

    logger.debug("✅ 视频文件准备完成");

    // 将标签合并到描述中
    let finalContent = content || "";
    if (tags && tags.length > 0) {
      const tagString = tags.map((tag) => `#${tag}`).join(" ");
      finalContent = `${finalContent} ${tagString}`.trim();
      logger.debug("📝 合并后的内容:", finalContent);
    }

    // 先启动视频上传
    logger.debug("📤 开始上传视频...");
    const uploadPromise = uploadVideo(videoFile).then(async () => {
      logger.debug("📤 视频文件已设置，等待上传完成...");
      await waitForUploadCompletion();
      logger.debug("✅ 视频上传完成");
    });

    // 等待一下确保视频上传已经开始
    await sleep(1000);

    // 然后开始填写表单
    logger.debug("📝 开始填写表单...");
    await fillDescription(finalContent);
    await fillTitle(title || "");
    logger.debug("✅ 表单填写完成");

    // 上传自定义封面
    if (cover) {
      logger.debug("🖼️ 开始上传自定义封面...");
      await uploadCover(cover, aspectRatio);
    }

    // 等待视频上传完成
    logger.debug("⏳ 等待视频上传完成...");
    await uploadPromise;

    // 自动发布
    if (data.isAutoPublish) {
      await sleep(5000);
      const publishButton = document.querySelector('button[type="submit"]') as HTMLButtonElement;
      if (publishButton) {
        logger.debug("🚀 点击发布按钮");
        publishButton.click();
      } else {
        logger.debug("⚠️ 未找到发布按钮");
      }
    }

    logger.debug("✅ Dewu视频发布完成");
  } catch (error) {
    logger.error("❌ Dewu视频发布过程中出错:", error);
    throw error;
  } finally {
    // 清理状态
    logger.debug("🧹 清理执行状态");
    (window as unknown as { __dewuRunning?: boolean }).__dewuRunning = false;
  }
}
